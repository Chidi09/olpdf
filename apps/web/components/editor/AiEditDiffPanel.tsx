"use client";

import React from "react";
import { DocumentBlock } from "@olpdf/document-model";
import { Sparkles } from "lucide-react";

interface AiEditDiffPanelProps {
  instruction: string;
  before: DocumentBlock[];
  after: DocumentBlock[];
  onAccept: () => void;
  onReject: () => void;
}

type ChangeCategory = "content" | "type" | "style" | "structural";

interface ChangeEntry {
  category: ChangeCategory;
  blockId: string;
  label: string;
  oldVal?: string;
  newVal?: string;
}

function describeStyleChanges(
  oldBlock: DocumentBlock | undefined,
  newBlock: DocumentBlock | undefined,
  blockId: string,
): ChangeEntry[] {
  const entries: ChangeEntry[] = [];

  if (!oldBlock && newBlock) {
    entries.push({ category: "structural", blockId, label: "Added block", newVal: newBlock.type });
    return entries;
  }
  if (oldBlock && !newBlock) {
    entries.push({ category: "structural", blockId, label: "Removed block", oldVal: oldBlock.type });
    return entries;
  }
  if (!oldBlock || !newBlock) return entries;

  if ((oldBlock.type || "paragraph") !== (newBlock.type || "paragraph")) {
    entries.push({
      category: "type",
      blockId,
      label: "Type changed",
      oldVal: oldBlock.type || "paragraph",
      newVal: newBlock.type || "paragraph",
    });
  }

  const oldFm = (oldBlock.font_meta || {}) as Record<string, unknown>;
  const newFm = (newBlock.font_meta || {}) as Record<string, unknown>;
  const fmChanges: string[] = [];
  if (oldFm.family !== newFm.family && newFm.family) fmChanges.push(`font: ${newFm.family}`);
  if (String(oldFm.size) !== String(newFm.size) && newFm.size) fmChanges.push(`size: ${newFm.size}pt`);
  if (oldFm.color !== newFm.color && newFm.color) fmChanges.push(`color: ${newFm.color}`);
  if (oldFm.is_bold !== newFm.is_bold) fmChanges.push(newFm.is_bold ? "bold" : "normal weight");
  if (oldFm.is_italic !== newFm.is_italic) fmChanges.push(newFm.is_italic ? "italic" : "normal style");
  if (fmChanges.length) {
    entries.push({ category: "style", blockId, label: fmChanges.join(", ") });
  }

  const oldSo = (oldBlock.style_overrides || {}) as Record<string, unknown>;
  const newSo = (newBlock.style_overrides || {}) as Record<string, unknown>;
  const soChanged = Object.keys({ ...oldSo, ...newSo }).filter(
    (k) => JSON.stringify(oldSo[k]) !== JSON.stringify(newSo[k]),
  );
  if (soChanged.length) {
    entries.push({
      category: "style",
      blockId,
      label: `Style: ${soChanged.join(", ")}`,
    });
  }

  const oldAlign = oldBlock.alignment;
  const newAlign = newBlock.alignment;
  if (oldAlign !== newAlign) {
    entries.push({
      category: "style",
      blockId,
      label: `Alignment: ${newAlign || "default"}`,
      oldVal: oldAlign || "default",
      newVal: newAlign || "default",
    });
  }

  return entries;
}

function computeChanges(before: DocumentBlock[], after: DocumentBlock[]): ChangeEntry[] {
  const allEntries: ChangeEntry[] = [];
  const oldMap = new Map(before.map((b) => [b.id, b]));
  const newMap = new Map(after.map((b) => [b.id, b]));

  const allIds = new Set([...oldMap.keys(), ...newMap.keys()]);

  for (const id of allIds) {
    const oldBlock = oldMap.get(id);
    const newBlock = newMap.get(id);

    const styleEntries = describeStyleChanges(oldBlock, newBlock, id);
    allEntries.push(...styleEntries);

    const oldContent = oldBlock?.content || "";
    const newContent = newBlock?.content || "";

    if (oldBlock && !newBlock) {
      continue; // handled above as "Removed"
    }
    if (!oldBlock && newBlock) {
      if (newContent) {
        allEntries.push({
          category: "content",
          blockId: id,
          label: "",
          newVal: newContent,
        });
      }
      continue;
    }
    if (oldContent !== newContent && oldBlock && newBlock) {
      allEntries.push({
        category: "content",
        blockId: id,
        label: "",
        oldVal: oldContent || "(empty)",
        newVal: newContent || "(empty)",
      });
    }
  }

  return allEntries;
}

function categoryIcon(cat: ChangeCategory): string {
  switch (cat) {
    case "content":
      return "\u270D";
    case "type":
      return "\u2192";
    case "style":
      return "\u26A1";
    case "structural":
      return "\u269B";
  }
}

function categoryColor(cat: ChangeCategory): string {
  switch (cat) {
    case "content":
      return "border-emerald-500";
    case "type":
      return "border-orange-500";
    case "style":
      return "border-blue-500";
    case "structural":
      return "border-purple-500";
  }
}

export default function AiEditDiffPanel({
  instruction,
  before,
  after,
  onAccept,
  onReject,
}: AiEditDiffPanelProps) {
  const changes = computeChanges(before, after);

  if (changes.length === 0) return null;

  const contentChanges = changes.filter((c) => c.category === "content");
  const typeChanges = changes.filter((c) => c.category === "type");
  const styleChanges = changes.filter((c) => c.category === "style");
  const structuralChanges = changes.filter((c) => c.category === "structural");

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl z-[60] p-6 animate-in slide-in-from-bottom-8 duration-500">
      <div className="rounded-xl border border-white/[0.08] bg-[#050505]/95 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col max-h-[50vh]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-3.5 w-3.5 text-orange-400/70" />
            <div>
              <h3 className="text-xs font-semibold text-[#ccc] leading-none mb-0.5">
                AI Suggestion
                {changes.length > 0 && (
                  <span className="ml-2 text-[10px] font-normal text-[#666]">
                    {changes.length} change{changes.length !== 1 ? "s" : ""}
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-[#666]">&ldquo;{instruction}&rdquo;</p>
            </div>
          </div>

          {structuralChanges.length > 0 && (
            <span className="hidden sm:block text-[10px] text-purple-400/60 mr-2">
              {structuralChanges.length} structural
            </span>
          )}

          <div className="flex gap-1.5">
            <button
              onClick={onReject}
              className="rounded-md border border-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-[#888] transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              Reject
            </button>
            <button
              onClick={onAccept}
              className="rounded-md bg-white px-3 py-1.5 text-[11px] font-semibold text-black transition-colors hover:bg-[#e5e5e5]"
            >
              Insert
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {structuralChanges.map((ch, idx) => (
            <div
              key={`s-${idx}`}
              className={`border-l-2 ${categoryColor(ch.category)} pl-3 py-1.5 rounded-r bg-purple-500/5`}
            >
              <span className="mr-2 text-purple-400/70 text-xs">{categoryIcon(ch.category)}</span>
              <span className="text-xs font-medium text-purple-300">{ch.label}</span>
              {ch.oldVal && <span className="text-[11px] text-[#666] ml-2">({ch.oldVal})</span>}
            </div>
          ))}

          {typeChanges.map((ch, idx) => (
            <div
              key={`t-${idx}`}
              className={`border-l-2 ${categoryColor(ch.category)} pl-3 py-1.5 rounded-r bg-orange-500/5`}
            >
              <span className="mr-2 text-orange-400/70 text-xs">{categoryIcon(ch.category)}</span>
              <span className="text-xs text-orange-300">
                <span className="line-through decoration-orange-500/40">{ch.oldVal}</span>
                <span className="mx-1.5 text-[#555]">{ch.newVal}</span>
              </span>
            </div>
          ))}

          {styleChanges.map((ch, idx) => (
            <div
              key={`y-${idx}`}
              className={`border-l-2 ${categoryColor(ch.category)} pl-3 py-1.5 rounded-r bg-blue-500/5`}
            >
              <span className="mr-2 text-blue-400/70 text-xs">{categoryIcon(ch.category)}</span>
              <span className="text-xs text-blue-300">{ch.label}</span>
            </div>
          ))}

          {contentChanges.map((ch, idx) => (
            <div
              key={`c-${idx}`}
              className={`border-l-2 ${categoryColor(ch.category)} pl-3 py-1.5 rounded-r bg-emerald-500/5`}
            >
              <span className="mr-2 text-emerald-400/70 text-xs">{categoryIcon(ch.category)}</span>
              {ch.oldVal !== undefined && (
                <div className="text-[#888] line-through decoration-red-500/30 text-sm mb-1">
                  {ch.oldVal}
                </div>
              )}
              <div className="text-emerald-400 text-sm font-medium">{ch.newVal}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
