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
      <div className="bg-[var(--bg-elevated)] border border-[var(--accent)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[40vh]">
        <div className="bg-[var(--accent-subtle)] p-4 border-b border-[var(--accent)] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4" />
            <div>
              <h3 className="text-sm font-bold text-[var(--accent)] leading-none mb-1">AI Suggestion</h3>
              <p className="text-[10px] text-[var(--text-secondary)] italic">&ldquo;{instruction}&rdquo;</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="px-4 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all"
            >
              Reject
            </button>
            <button
              onClick={onAccept}
              className="px-4 py-1.5 rounded bg-[var(--accent)] hover:opacity-90 text-[var(--text-on-accent)] text-xs font-bold transition-all"
            >
              Accept & Apply
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
