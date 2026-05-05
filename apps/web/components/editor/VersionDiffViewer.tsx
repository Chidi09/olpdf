"use client";

import React from "react";
import { X } from "lucide-react";
import { DocumentModel } from "@olpdf/document-model";

interface VersionDiffViewerProps {
  oldVersion: DocumentModel;
  newVersion: DocumentModel;
  onClose: () => void;
}

export default function VersionDiffViewer({
  oldVersion,
  newVersion,
  onClose,
}: VersionDiffViewerProps) {
  // Simple diffing logic based on block content and order
  const diffBlocks = () => {
    const changes: {
      type: "added" | "removed" | "changed" | "unchanged";
      content: string;
      oldContent?: string;
    }[] = [];

    const oldContentMap = new Map(
      oldVersion.blocks.map((block) => [block.id, block.content || ""])
    );
    const newContentMap = new Map(
      newVersion.blocks.map((block) => [block.id, block.content || ""])
    );

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
      } else if (oldContent !== undefined) {
        changes.push({ type: "unchanged", content: oldContent });
      }
    });

    return changes;
  };

  const changes = diffBlocks();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)] bg-opacity-75 backdrop-blur-sm">
      <div className="bg-[var(--bg-surface)] p-6 rounded-lg shadow-xl w-3/4 h-3/4 max-w-4xl flex flex-col">
        <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-3 mb-4">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Version Comparison
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 text-sm font-mono">
          {changes.length === 0 && (
            <p className="text-[var(--text-secondary)]">No changes detected between these versions.</p>
          )}
          {changes.map((change, index) => (
            <div key={index}>
              {change.type === "added" && (
                <p className="text-[var(--status-ok)] bg-[var(--status-ok)]/10 p-1 rounded">
                  + {change.content}
                </p>
              )}
              {change.type === "removed" && (
                <p className="text-[var(--status-error)] bg-[var(--status-error)]/10 p-1 rounded">
                  - {change.content}
                </p>
              )}
              {change.type === "changed" && (
                <div>
                  <p className="text-[var(--status-error)] bg-[var(--status-error)]/10 p-1 rounded">
                    - {change.oldContent}
                  </p>
                  <p className="text-[var(--status-ok)] bg-[var(--status-ok)]/10 p-1 rounded">
                    + {change.content}
                  </p>
                </div>
              )}
              {change.type === "unchanged" && (
                <p className="text-[var(--text-secondary)]">
                  {change.content}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
