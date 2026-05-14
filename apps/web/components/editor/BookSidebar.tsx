"use client";

import React from "react";
import { BookModel } from "@olpdf/document-model";
import { BookOpenIcon } from "@heroicons/react/24/outline";

export type BookMatterKey = "title_page" | "copyright" | "toc" | "about_author";

interface BookSidebarProps {
  book: BookModel;
  activeChapterId: string | null;
  onSelectChapter: (chapterId: string) => void;
  onAddChapter: () => void;
  onOpenCoverBuilder: () => void;
  onOpenAiHistory?: () => void;
  activeMatterKey?: BookMatterKey | null;
  onSelectMatter?: (key: BookMatterKey) => void;
}

export default function BookSidebar({
  book,
  activeChapterId,
  onSelectChapter,
  onAddChapter,
  onOpenCoverBuilder,
  onOpenAiHistory,
  activeMatterKey,
  onSelectMatter,
}: BookSidebarProps) {
  return (
    <aside className="w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-y-auto flex flex-col">
      {/* ... previous code ... */}
      <div className="p-6 border-b border-[var(--border-subtle)]">
        <h2 className="text-xl font-display font-bold text-[var(--accent)] flex items-center gap-2">
          <BookOpenIcon className="h-5 w-5" /> {book.title}
        </h2>
        <div className="flex gap-4 mt-2">
            <button 
                onClick={onOpenCoverBuilder}
                className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
            >
                Edit Cover
            </button>
            {onOpenAiHistory && (
              <button
                onClick={onOpenAiHistory}
                className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
              >
                AI History
              </button>
            )}
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="mb-8">
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-tertiary)] mb-3 px-2">
            Front Matter
          </h3>
            <ul className="space-y-1">
            {(["title_page", "copyright", "toc"] as BookMatterKey[]).map((key) => {
              const label = key === "title_page" ? "Title Page" : key === "copyright" ? "Copyright" : "Table of Contents";
              return (
                <li
                  key={key}
                  onClick={() => onSelectMatter?.(key)}
                  className={`px-2 py-1.5 text-sm cursor-pointer rounded transition-colors ${
                    activeMatterKey === key
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-l-2 border-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  {label}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-tertiary)]">
              Chapters
            </h3>
            <button 
              onClick={onAddChapter}
              className="text-[var(--accent)] hover:text-[var(--accent-strong)] text-lg"
              title="Add Chapter"
            >
              +
            </button>
          </div>
          <ul className="space-y-1">
            {book.chapters.map((chapter) => (
              <li
                key={chapter.id}
                onClick={() => chapter.document_id && onSelectChapter(chapter.document_id)}
                className={`group px-2 py-2 text-sm rounded cursor-pointer transition-all flex items-center justify-between ${
                  chapter.document_id === activeChapterId
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-l-2 border-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    chapter.status === "final" ? "bg-[var(--status-ok)]" :
                    chapter.status === "review" ? "bg-[var(--status-review)]" :
                    "bg-[var(--text-tertiary)]"
                  }`} />
                  <span className="truncate">Ch {chapter.chapter_number}: {chapter.title}</span>
                </div>
                {chapter.document_id === activeChapterId && (
                    <span className="text-[10px] bg-[var(--accent)] text-[var(--text-on-accent)] px-1.5 py-0.5 rounded font-bold">EDITING</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-tertiary)] mb-3 px-2">
                Back Matter
            </h3>
            <ul className="space-y-1">
                <li
                  onClick={() => onSelectMatter?.("about_author")}
                  className={`px-2 py-1.5 text-sm cursor-pointer rounded transition-colors ${
                    activeMatterKey === "about_author"
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)] border-l-2 border-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                    About the Author
                </li>
            </ul>
        </div>
      </div>
    </aside>
  );
}
