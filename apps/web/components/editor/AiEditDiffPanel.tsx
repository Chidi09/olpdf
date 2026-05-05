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
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-glass)] backdrop-blur-md">
          {changes.map((change, idx) => (
            <div key={idx} className="text-xs font-mono border-l-2 pl-3 py-1 bg-white/5 rounded-r">
              {change.type === "added" && (
                <div className="text-[var(--status-ok)]">
                  <span className="opacity-50 mr-2">+</span>
                  {change.content}
                </div>
              )}
              {change.type === "removed" && (
                <div className="text-[var(--status-error)] line-through">
                  <span className="opacity-50 mr-2">-</span>
                  {change.content}
                </div>
              )}
              {change.type === "changed" && (
                <div className="space-y-1">
                  <div className="text-[var(--status-error)] line-through opacity-60">
                    <span className="opacity-50 mr-2">-</span>
                    {change.oldContent}
                  </div>
                  <div className="text-[var(--status-ok)]">
                    <span className="opacity-50 mr-2">+</span>
                    {change.content}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
