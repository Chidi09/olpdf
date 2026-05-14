"use client";

import React from "react";
import { DocumentBlock } from "@olpdf/document-model";
import { Sparkles } from "lucide-react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { GlassCard } from "@/components/ui/Glass";

interface AiEditDiffPanelProps {
  instruction: string;
  before: DocumentBlock[];
  after: DocumentBlock[];
  onAccept: () => void;
  onReject: () => void;
}

export default function AiEditDiffPanel({
  instruction,
  before,
  after,
  onAccept,
  onReject,
}: AiEditDiffPanelProps) {
  const diffBlocks = () => {
    const changes: {
      type: "added" | "removed" | "changed" | "unchanged";
      content: string;
      oldContent?: string;
    }[] = [];

    const oldContentMap = new Map(before.map((b) => [b.id, b.content || ""]));
    const newContentMap = new Map(after.map((b) => [b.id, b.content || ""]));

    const allBlockIds = new Set([
      ...oldContentMap.keys(),
      ...newContentMap.keys(),
    ]);

    allBlockIds.forEach((id) => {
      const oldContent = oldContentMap.get(id);
      const newContent = newContentMap.get(id);

      if (oldContent === undefined && newContent !== undefined) {
        changes.push({ type: "added", content: newContent });
      } else if (oldContent !== undefined && newContent === undefined) {
        changes.push({ type: "removed", content: oldContent });
      } else if (oldContent !== newContent) {
        changes.push({
          type: "changed",
          oldContent: oldContent,
          content: newContent || "",
        });
      }
    });

    return changes;
  };

  const changes = diffBlocks();

  if (changes.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl z-[60] p-6 animate-in slide-in-from-bottom-8 duration-500">
      <div className="rounded-xl border border-white/[0.08] bg-[#050505]/95 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col max-h-[40vh]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-3.5 w-3.5 text-orange-400/70" />
            <div>
              <h3 className="text-xs font-semibold text-[#ccc] leading-none mb-0.5">AI Suggestion</h3>
              <p className="text-[10px] text-[#666]">&ldquo;{instruction}&rdquo;</p>
            </div>
          </div>
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {changes.map((change, idx) => (
            <div key={idx} className="relative group">
              {change.type === "removed" && (
                <div className="text-red-400/50 line-through decoration-red-500/30 text-sm">
                  {change.content}
                </div>
              )}
              {change.type === "added" && (
                <div className="text-emerald-400 bg-emerald-500/5 border-l-2 border-emerald-500 pl-3 py-1 text-sm font-medium rounded-r">
                  {change.content}
                </div>
              )}
              {change.type === "changed" && (
                <div className="space-y-1">
                  <div className="text-red-400/50 line-through decoration-red-500/30 text-sm">
                    {change.oldContent}
                  </div>
                  <div className="text-emerald-400 bg-emerald-500/5 border-l-2 border-emerald-500 pl-3 py-1 text-sm font-medium rounded-r">
                    {change.content}
                  </div>
                </div>
              )}
              {change.type === "unchanged" && (
                <div className="text-sm text-[var(--text-secondary)] opacity-60">
                  {change.content}
                </div>
              )}

              <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full opacity-0 group-hover:opacity-100 transition-all duration-200">
                <GlassCard className="flex flex-row p-1 gap-1">
                  <button
                    onClick={onAccept}
                    className="p-1.5 text-emerald-500 hover:bg-emerald-500/20 rounded-md transition-colors"
                  >
                    <CheckIcon className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={onReject}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/20 rounded-md transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </GlassCard>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
