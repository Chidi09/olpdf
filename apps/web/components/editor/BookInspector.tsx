"use client";

import React from "react";
import { BookModel, BookChapter } from "@olpdf/document-model";
import { FileType2, Sparkles, Scale, FileOutput, Tablet } from "lucide-react";

type ChapterStatus = "draft" | "review" | "final";

interface BookInspectorProps {
  book: BookModel;
  activeChapter: BookChapter | null;
  onUpdateChapter: (chapterId: string, updates: Partial<BookChapter>) => void;
  onExportBook: (format: "pdf" | "epub") => void;
  onCheckConsistency: () => void;
}

export default function BookInspector({
  book,
  activeChapter,
  onUpdateChapter,
  onExportBook,
  onCheckConsistency,
}: BookInspectorProps) {
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
                <span className="text-[var(--text-primary)] font-mono">{activeChapter.word_count.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Read Time</span>
                <span className="text-[var(--text-primary)]">~{Math.ceil(activeChapter.word_count / 200)} min</span>
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
        <p className="text-[11px] text-[var(--text-tertiary)] mb-3 truncate">{book.title}</p>
        <div className="space-y-3">
             <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Font</span>
                <span className="text-[var(--text-primary)]">Lora</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Trim Size</span>
                <span className="text-[var(--text-primary)]">6 x 9</span>
            </div>
            <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Leading</span>
                <span className="text-[var(--text-primary)] font-mono">1.7</span>
            </div>
        </div>
      </div>

      <div className="mb-10">
        <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--text-tertiary)] mb-4">
          AI Book Tools
        </h3>
        <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-sm rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all flex items-center gap-2 group">
                <Sparkles className="h-4 w-4 group-hover:animate-pulse" /> Continue Narrative
            </button>
            <button className="w-full text-left px-3 py-2 text-sm rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all flex items-center gap-2 group">
                <FileType2 className="h-4 w-4 group-hover:rotate-12 transition-transform" /> Suggest Chapter Title
            </button>
            <button 
                onClick={onCheckConsistency}
                className="w-full text-left px-3 py-2 text-sm rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all flex items-center gap-2 group"
            >
                <Scale className="h-4 w-4 group-hover:scale-110 transition-transform" /> Check Consistency (RAG)
            </button>
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-[var(--border-subtle)]">
        <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--text-tertiary)] mb-4">
          Publish
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => onExportBook("pdf")}
            className="flex flex-col items-center justify-center p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all"
          >
            <FileOutput className="mb-1 h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-tighter text-[var(--text-primary)]">Print PDF</span>
          </button>
          <button 
            onClick={() => onExportBook("epub")}
            className="flex flex-col items-center justify-center p-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all"
          >
            <Tablet className="mb-1 h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-tighter text-[var(--text-primary)]">Kindle EPUB</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
