"use client";

import React from "react";
import { Scale, X, ArrowRight } from "lucide-react";

interface Inconsistency {
  chapter_id: string;
  chapter_title: string;
  chunk_index: number;
  content: string;
  issue: string;
}

interface ConsistencyResultsPanelProps {
  analysis: string;
  inconsistencies: Inconsistency[];
  onClose: () => void;
  onGoToBlock: (chapterId: string, chunkIndex: number) => void;
}

export default function ConsistencyResultsPanel({
  analysis,
  inconsistencies,
  onClose,
  onGoToBlock,
}: ConsistencyResultsPanelProps) {
  return (
    <div className="fixed bottom-0 right-0 w-96 max-h-[80vh] m-6 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-glass)] flex justify-between items-center">
        <h3 className="text-sm font-bold text-[var(--accent)] flex items-center gap-2">
          <Scale className="h-4 w-4" /> Consistency Check
        </h3>
        <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)]">
            <p className="text-xs text-[var(--text-primary)] leading-relaxed">{analysis}</p>
        </div>

        <div>
            <h4 className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-tertiary)] mb-3">
                Detected Inconsistencies ({inconsistencies.length})
            </h4>
            <div className="space-y-3">
                {inconsistencies.length === 0 ? (
                    <p className="text-xs text-[var(--status-ok)] italic">No inconsistencies detected! Your narrative is consistent.</p>
                ) : (
                    inconsistencies.map((inc, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 group">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-tighter">ISSUE</span>
                                <span className="text-[10px] text-[var(--text-tertiary)]">{inc.chapter_title}</span>
                            </div>
                            <p className="text-xs text-[var(--text-primary)] mb-2 font-medium">&quot;{inc.content}&quot;</p>
                            <p className="text-[11px] text-red-300/80 mb-3 italic">{inc.issue}</p>
                            <button 
                                onClick={() => onGoToBlock(inc.chapter_id, inc.chunk_index)}
                                className="text-[10px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
                            >
                                GO TO BLOCK <ArrowRight className="h-3 w-3" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

      <div className="p-4 bg-[var(--bg-base)] border-t border-[var(--border-subtle)]">
        <button 
            onClick={onClose}
            className="w-full py-2 rounded bg-[var(--accent)] text-[var(--text-on-accent)] font-bold text-xs hover:opacity-90"
        >
            Dismiss Analysis
        </button>
      </div>
    </div>
  );
}
