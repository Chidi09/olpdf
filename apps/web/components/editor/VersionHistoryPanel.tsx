"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { VersionHistoryEntry } from "@olpdf/document-model";

interface VersionHistoryPanelProps {
  documentId: string;
  onSelectVersion: (versionId: string) => void;
  onCompareVersions: (versionId1: string, versionId2: string | null) => void;
  currentDocumentId: string;
}

export default function VersionHistoryPanel({
  documentId,
  onSelectVersion,
  onCompareVersions,
  currentDocumentId,
}: VersionHistoryPanelProps) {
  const {
    data: versions,
    isLoading,
    isError,
  } = useQuery<VersionHistoryEntry[]>({
    queryKey: ["documentVersions", documentId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/versions`);
      if (!response.ok) {
        throw new Error("Failed to fetch document versions");
      }
      return response.json();
    },
  });

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(dateStr));
  };

  if (isLoading) {
    return <div className="p-4 text-[var(--text-secondary)] text-sm">Loading versions...</div>;
  }

  if (isError) {
    return (
      <div className="p-4 text-[var(--status-error)] text-sm">
        Error loading versions.
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto max-h-[calc(100vh-120px)]">
      <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--text-secondary)] mb-4">
        Version History
      </h3>
      {versions && versions.length === 0 && (
        <p className="text-[var(--text-secondary)] text-sm italic">No versions saved yet.</p>
      )}
      <ul className="space-y-3">
        {versions &&
          versions.map((version) => (
            <li
              key={version.id}
              className={`p-3 rounded border transition-all ${
                version.id === currentDocumentId
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--border-subtle)] bg-[var(--bg-glass)] hover:border-[var(--accent)]"
              }`}
            >
              <div className="text-[var(--text-primary)] text-sm font-semibold truncate">
                {version.version_name || "Untitled Version"}
              </div>
              <div className="text-[var(--text-secondary)] text-[10px] mt-0.5">
                {formatDate(version.created_at)}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={() => onSelectVersion(version.id)}
                  className="text-[10px] font-bold uppercase tracking-tighter text-[var(--accent)] hover:underline"
                >
                  Restore
                </button>
                <div className="w-1 h-1 rounded-full bg-[var(--border-subtle)]" />
                <button
                  onClick={() => onCompareVersions(version.id, null)}
                  className="text-[10px] font-bold uppercase tracking-tighter text-[var(--text-secondary)] hover:text-[var(--accent)]"
                >
                  Diff with Current
                </button>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}
