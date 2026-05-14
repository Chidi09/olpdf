"use client";

import React, { useState } from "react";
import { BookModel, BookChapter } from "@olpdf/document-model";
import { SparklesIcon, ScaleIcon, ArrowDownTrayIcon, DeviceTabletIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { InlineSpinner } from "@/components/ui/MicroUI";

type ChapterStatus = "draft" | "review" | "final";

interface BookInspectorProps {
  book: BookModel;
  activeChapter: BookChapter | null;
  onUpdateChapter: (chapterId: string, updates: Partial<BookChapter>) => void;
  onExportBook: (format: "pdf" | "epub") => Promise<void>;
  onCheckConsistency: () => void;
  onContinueNarrative?: () => void;
  onSuggestChapterTitle?: () => void;
  isNarrativeRunning?: boolean;
  isTitleLoading?: boolean;
  exportStatus?: string;
  onUpdateBookMeta?: (updates: Record<string, unknown>) => void;
}

const FONTS = ["Lora", "Merriweather", "Georgia", "Times New Roman", "Inter"];
const TRIM_SIZES = ["5 x 8", "5.5 x 8.5", "6 x 9", "A5"];

export default function BookInspector({
  book,
  activeChapter,
  onUpdateChapter,
  onExportBook,
  onCheckConsistency,
  onContinueNarrative,
  onSuggestChapterTitle,
  isNarrativeRunning,
  isTitleLoading,
  exportStatus,
  onUpdateBookMeta,
}: BookInspectorProps) {
  const styles = (book.meta?.styles as Record<string, string>) || {};

  const setStyle = (key: string, value: string) => {
    onUpdateBookMeta?.({ styles: { ...styles, [key]: value } });
  };

  return (
    <aside className="w-72 border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-y-auto flex flex-col p-6">
      {activeChapter ? (
        <div className="mb-10">
          <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--text-tertiary)] mb-4">
            Chapter Info
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] uppercase block mb-1">Status</label>
              <select 
                value={activeChapter.status}
                onChange={(e) => onUpdateChapter(activeChapter.id!, { status: e.target.value as ChapterStatus })}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm rounded px-3 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Word Count</span>
                <span className="text-[var(--text-primary)] font-mono">{(activeChapter.word_count ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Read Time</span>
                <span className="text-[var(--text-primary)]">~{Math.ceil((activeChapter.word_count ?? 0) / 200)} min</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-10 p-4 bg-[var(--bg-elevated)]/50 rounded-lg border border-dashed border-[var(--border-subtle)] text-center">
            <p className="text-xs text-[var(--text-tertiary)]">Select a chapter to see details</p>
        </div>
      )}

      <div className="mb-10">
        <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--text-tertiary)] mb-4">
          Book Styles
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] uppercase block mb-1">Font</label>
            <select
              value={styles.font_family || "Lora"}
              onChange={(e) => setStyle("font_family", e.target.value)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm rounded px-2 py-1.5 text-[var(--text-primary)] outline-none"
            >
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] uppercase block mb-1">Trim Size</label>
            <select
              value={styles.trim_size || "6 x 9"}
              onChange={(e) => setStyle("trim_size", e.target.value)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm rounded px-2 py-1.5 text-[var(--text-primary)] outline-none"
            >
              {TRIM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] uppercase block mb-1">Leading</label>
            <input
              type="number"
              min={1.1}
              max={2.2}
              step={0.1}
              value={styles.leading || "1.7"}
              onChange={(e) => setStyle("leading", e.target.value)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm rounded px-2 py-1.5 text-[var(--text-primary)] outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mb-10">
        <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--text-tertiary)] mb-4">
          AI Book Tools
        </h3>
        <div className="space-y-2">
            <button
              onClick={onContinueNarrative}
              disabled={isNarrativeRunning}
              className="w-full text-left px-3 py-2 text-sm rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all flex items-center gap-2 group disabled:opacity-50"
            >
                {isNarrativeRunning ? <InlineSpinner className="h-4 w-4" /> : <SparklesIcon className="h-4 w-4 group-hover:animate-pulse" />} Continue Narrative
            </button>
            <button
              onClick={onSuggestChapterTitle}
              disabled={isTitleLoading}
              className="w-full text-left px-3 py-2 text-sm rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all flex items-center gap-2 group disabled:opacity-50"
            >
                {isTitleLoading ? <InlineSpinner className="h-4 w-4" /> : <DocumentTextIcon className="h-4 w-4 group-hover:rotate-12 transition-transform" />} Suggest Chapter Title
            </button>
            <button 
                onClick={onCheckConsistency}
                className="w-full text-left px-3 py-2 text-sm rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all flex items-center gap-2 group"
            >
                <ScaleIcon className="h-4 w-4 group-hover:scale-110 transition-transform" /> Check Consistency (RAG)
            </button>
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-[var(--border-subtle)]">
        <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--text-tertiary)] mb-4">
          Publish
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => void onExportBook("pdf")}
            className="flex flex-col items-center justify-center p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all"
          >
            <ArrowDownTrayIcon className="mb-1 h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-tighter text-[var(--text-primary)]">Print PDF</span>
          </button>
          <button 
            onClick={() => void onExportBook("epub")}
            className="flex flex-col items-center justify-center p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all"
          >
            <DeviceTabletIcon className="mb-1 h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-tighter text-[var(--text-primary)]">Kindle EPUB</span>
          </button>
        </div>
        {exportStatus && (
          <p className="mt-2 text-[10px] text-center text-[var(--text-tertiary)]">{exportStatus}</p>
        )}
      </div>
    </aside>
  );
}
