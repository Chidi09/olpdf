"use client";

import React, { useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import BookSidebar from "./BookSidebar";
import BookInspector from "./BookInspector";
import CollaborativeEditor from "../CollaborativeEditor";
import CoverBuilder from "./CoverBuilder";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { BookModel, BookChapter } from "@olpdf/document-model";
import { useBookStore } from "@/store/useBookStore";

interface BookWorkspaceProps {
  bookId: string;
  userName: string;
  userColor: string;
}

export default function BookWorkspace({ bookId, userName, userColor }: BookWorkspaceProps) {
  const queryClient = useQueryClient();
  const { activeDocumentId, isSidebarOpen, setActiveDocumentId, toggleSidebar } = useBookStore();
  const [isCoverBuilderOpen, setIsCoverBuilderOpen] = useState(false);

  const { data: book, isLoading } = useQuery<BookModel>({
    queryKey: ["book", bookId],
    queryFn: async () => {
      const res = await fetch(`/api/bff/books/${bookId}`);
      if (!res.ok) throw new Error("Failed to fetch book");
      return res.json();
    },
  });

  const selectedDocumentId = useMemo(() => {
    if (activeDocumentId) return activeDocumentId;
    const first = book?.chapters?.[0];
    return first?.document_id ?? null;
  }, [activeDocumentId, book?.chapters]);

  const activeChapter = useMemo(() => {
    return book?.chapters?.find((chapter) => chapter.document_id === selectedDocumentId) ?? null;
  }, [book?.chapters, selectedDocumentId]);

  const safeBook: BookModel = book ?? { title: "Untitled Book", meta: {}, chapters: [] };

  const updateBookMetaMutation = useMutation({
    mutationFn: async (metaUpdates: Record<string, unknown>) => {
      const res = await fetch(`/api/bff/books/${bookId}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metaUpdates),
      });
      if (!res.ok) throw new Error("Failed to update book metadata");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["book", bookId] }),
  });

  const updateChapterMutation = useMutation({
    mutationFn: async ({ chapterId, updates }: { chapterId: string; updates: Partial<BookChapter> }) => {
      const payload: Partial<BookChapter> = { ...(activeChapter ?? {}), ...updates };
      const res = await fetch(`/api/bff/books/${bookId}/chapters/${chapterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update chapter");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["book", bookId] }),
  });

  const addChapterMutation = useMutation({
    mutationFn: async () => {
      const nextNumber = (book?.chapters?.length ?? 0) + 1;
      const res = await fetch(`/api/bff/books/${bookId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter_number: nextNumber, title: `Chapter ${nextNumber}`, status: "draft", word_count: 0 }),
      });
      if (!res.ok) throw new Error("Failed to add chapter");
      return res.json() as Promise<{ document_id?: string }>;
    },
    onSuccess: (result) => {
      if (result.document_id) setActiveDocumentId(result.document_id);
      queryClient.invalidateQueries({ queryKey: ["book", bookId] });
    },
  });

  const exportBook = async (format: "pdf" | "epub") => {
    await fetch(`/api/bff/books/${bookId}/export/${format}`, { method: "POST" });
  };

  const checkConsistency = async () => {
    await fetch(`/api/bff/books/${bookId}/consistency`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "Check character and timeline consistency." }),
    });
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[var(--bg-base)] text-[var(--text-secondary)]">
        <div className="animate-pulse">Loading Book Workspace...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-[var(--bg-base)] overflow-hidden">
      {isCoverBuilderOpen && (
        <CoverBuilder 
          onClose={() => setIsCoverBuilderOpen(false)} 
          onSave={(coverUrl) => {
            updateBookMetaMutation.mutate({ cover_url: coverUrl });
            setIsCoverBuilderOpen(false);
          }} 
        />
      )}
      <div className={`transition-all duration-300 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] ${isSidebarOpen ? "w-64" : "w-0 overflow-hidden"}`}>
        <BookSidebar
          book={safeBook}
          activeChapterId={selectedDocumentId}
          onSelectChapter={setActiveDocumentId}
          onAddChapter={() => addChapterMutation.mutate()}
          onOpenCoverBuilder={() => setIsCoverBuilderOpen(true)}
        />
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div className="h-12 border-b border-[var(--border-subtle)] flex items-center px-4 bg-[var(--bg-surface)]/50 backdrop-blur-sm">
          <button onClick={toggleSidebar} className="p-1 hover:bg-white/5 rounded text-[var(--text-secondary)]">
            {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
          <div className="ml-4 flex-1">
            <h1 className="text-sm font-bold text-[var(--text-primary)]">
              {book?.title} <span className="mx-2 text-[var(--text-tertiary)]">/</span> {activeChapter?.title}
            </h1>
          </div>
          <div className="flex gap-2">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              activeChapter?.status === "final" ? "bg-green-500/10 text-green-400" :
              activeChapter?.status === "review" ? "bg-amber-500/10 text-amber-400" :
              "bg-white/5 text-[var(--text-secondary)]"
            }`}>
              {activeChapter?.status || "draft"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-[var(--bg-base)]">
          {selectedDocumentId ? (
            <div className="w-full max-w-3xl bg-white shadow-2xl min-h-[1056px] rounded-sm overflow-hidden">
              <CollaborativeEditor documentId={selectedDocumentId} userName={userName} userColor={userColor} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-tertiary)]">
              <p>Select a chapter to start writing.</p>
            </div>
          )}
        </div>
      </div>

      <div className="w-80 border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col">
        <BookInspector
          book={safeBook}
          activeChapter={activeChapter}
          onUpdateChapter={(chapterId, updates) => updateChapterMutation.mutate({ chapterId, updates })}
          onExportBook={exportBook}
          onCheckConsistency={checkConsistency}
        />
      </div>
    </div>
  );
}
