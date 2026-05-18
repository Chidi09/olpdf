"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X, ChevronRight } from "lucide-react";

interface AiLogEntry {
  id: string;
  instruction: string;
  status: "pending_review" | "accepted" | "rejected";
  created_at: string;
  tool_calls: { name: string; args: Record<string, unknown> }[];
}

interface AiHistoryPanelProps {
  documentId: string;
  onSelectLog: (log: AiLogEntry) => void;
  onClose: () => void;
}

export default function AiHistoryPanel({
  documentId,
  onSelectLog,
  onClose,
}: AiHistoryPanelProps) {
  const { data: logs, isLoading } = useQuery<AiLogEntry[]>({
    queryKey: ["ai-logs", documentId],
    queryFn: async () => {
      const response = await fetch(`/api/bff/ai/documents/${documentId}/logs`);
      if (!response.ok) throw new Error("Failed to fetch AI logs");
      return response.json();
    },
  });

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-[var(--bg-surface)] border-l border-[var(--border-strong)] z-40 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-glass)] flex justify-between items-center">
        <h3 className="text-sm font-bold text-[var(--accent)] flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> AI Edit History
        </h3>
        <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-10 text-[var(--text-tertiary)] text-xs">Loading logs...</div>
        ) : logs?.length === 0 ? (
          <div className="text-center py-10 text-[var(--text-tertiary)] text-xs">No AI edits yet.</div>
        ) : (
          logs?.map((log) => (
            <div 
              key={log.id}
              onClick={() => onSelectLog(log)}
              className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all group"
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  log.status === 'accepted' ? 'bg-green-500/10 text-green-400' :
                  log.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                  'bg-amber-500/10 text-amber-400'
                }`}>
                  {log.status}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-[var(--text-primary)] line-clamp-2 italic mb-2">&ldquo;{log.instruction}&rdquo;</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-tertiary)]">{log.tool_calls?.length || 0} tools used</span>
                <span className="text-[10px] text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">View Details <ChevronRight className="h-3 w-3" /></span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
