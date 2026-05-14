"use client";

import React, { useMemo, useState } from "react";
import { Bars3CenterLeftIcon, XMarkIcon } from "@heroicons/react/24/outline";
import BookSidebar, { type BookMatterKey } from "./BookSidebar";
import BookInspector from "./BookInspector";
import CollaborativeEditor from "../CollaborativeEditor";
import CoverBuilder from "./CoverBuilder";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { BookModel, BookChapter } from "@olpdf/document-model";
import { useBookStore } from "@/store/useBookStore";

interface BookWorkspaceProps {
  bookId: string;
  userName?: string;
  userColor?: string;
}

export default function BookWorkspace({ bookId, userName = "You", userColor = "#e6a449" }: BookWorkspaceProps) {
  const queryClient = useQueryClient();
  const { activeDocumentId, isSidebarOpen, setActiveDocumentId, toggleSidebar } = useBookStore();
  const [isCoverBuilderOpen, setIsCoverBuilderOpen] = useState(false);
  const [activeMatterKey, setActiveMatterKey] = useState<BookMatterKey | null>(null);
  const [isNarrativeRunning, setIsNarrativeRunning] = useState(false);
  const [isTitleLoading, setIsTitleLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [consistencyResult, setConsistencyResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

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

  const handleSelectMatter = async (key: BookMatterKey) => {
    setActiveMatterKey(key);
    setActiveDocumentId(""); // clear chapter selection
    const response = await fetch(`/api/bff/books/${bookId}/matter/${key}`, { method: "POST" });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    if (data?.document_id) setActiveDocumentId(data.document_id);
  };

  const handleSelectChapter = (docId: string) => {
    setActiveMatterKey(null);
    setActiveDocumentId(docId);
  };

  const activeChapter = useMemo(() => {
    if (activeMatterKey) return null;
    return book?.chapters?.find((chapter) => chapter.document_id === selectedDocumentId) ?? null;
  }, [book?.chapters, selectedDocumentId, activeMatterKey]);

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
    setExportStatus(`Exporting ${format.toUpperCase()}...`);
    try {
      const response = await fetch(`/api/bff/books/${bookId}/export/${format}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.detail || "Export failed");
      window.open(data.url, "_blank", "noopener,noreferrer");
      setExportStatus(`${format.toUpperCase()} exported`);
      setTimeout(() => setExportStatus(null), 3000);
    } catch {
      setExportStatus(`${format.toUpperCase()} export failed`);
      setTimeout(() => setExportStatus(null), 5000);
    }
  };

  const checkConsistency = async () => {
    setAiError(null);
    try {
      const res = await fetch(`/api/bff/books/${bookId}/consistency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Check character and timeline consistency." }),
      });
      if (!res.ok) { const data = await res.json().catch(() => ({})); setAiError(data?.detail || data?.message || "Consistency check failed"); return; }
      const data = await res.json();
      const text = typeof data?.result === "string" ? data.result : typeof data?.message === "string" ? data.message : JSON.stringify(data);
      setConsistencyResult(text);
      setTimeout(() => setConsistencyResult(null), 15000);
    } catch {
      setAiError("Consistency check failed due to a network error.");
    }
  };

  const continueNarrative = async () => {
    if (!activeChapter?.id) return;
    setIsNarrativeRunning(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/bff/books/${bookId}/chapters/${activeChapter.id}/continue`, { method: "POST" });
      if (!res.ok) { const data = await res.json().catch(() => ({})); setAiError(data?.detail || data?.message || "Continue narrative failed"); return; }
      const data = await res.json();
      if (data.document_model) {
        queryClient.invalidateQueries({ queryKey: ["document", activeChapter.document_id] });
      }
    } catch {
      setAiError("Continue narrative failed due to a network error.");
    } finally {
      setIsNarrativeRunning(false);
    }
  };

  const suggestChapterTitle = async () => {
    if (!activeChapter?.id) return;
    setIsTitleLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/bff/books/${bookId}/chapters/${activeChapter.id}/suggest-title`, { method: "POST" });
      if (!res.ok) { const data = await res.json().catch(() => ({})); setAiError(data?.detail || data?.message || "Title suggestion failed"); return; }
      const data = await res.json();
      const suggested = data.title || "Untitled Chapter";
      if (window.confirm(`Suggest chapter title: "${suggested}"?`)) {
        await fetch(`/api/bff/books/${bookId}/chapters/${activeChapter.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...activeChapter, title: suggested }),
        });
        queryClient.invalidateQueries({ queryKey: ["book", bookId] });
      }
    } catch {
      setAiError("Title suggestion failed due to a network error.");
    } finally {
      setIsTitleLoading(false);
    }
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
          activeChapterId={activeMatterKey ? null : selectedDocumentId}
          onSelectChapter={handleSelectChapter}
          onAddChapter={() => addChapterMutation.mutate()}
          onOpenCoverBuilder={() => setIsCoverBuilderOpen(true)}
          activeMatterKey={activeMatterKey}
          onSelectMatter={handleSelectMatter}
        />
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div className="h-12 border-b border-[var(--border-subtle)] flex items-center px-4 bg-[var(--bg-surface)]/50 backdrop-blur-sm">
          <button onClick={toggleSidebar} className="p-1 hover:bg-white/5 rounded text-[var(--text-secondary)]" aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}>
            {isSidebarOpen ? <XMarkIcon className="h-4 w-4" /> : <Bars3CenterLeftIcon className="h-4 w-4" />}
          </button>
          <div className="ml-4 flex-1">
            <h1 className="text-sm font-bold text-[var(--text-primary)]">
              {book?.title} <span className="mx-2 text-[var(--text-tertiary)]">/</span> {activeChapter?.title || (activeMatterKey ? activeMatterKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "")}
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

      <div className={`border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-300 flex flex-col ${isInspectorOpen ? "w-80" : "w-10 overflow-hidden"}`}>
        {!isInspectorOpen ? (
          <button onClick={() => setIsInspectorOpen(true)} className="flex h-full w-10 items-start justify-center pt-4 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" aria-label="Open inspector">
            <Bars3CenterLeftIcon className="h-4 w-4" />
          </button>
        ) : (
        <>
        <div className="flex items-center justify-between h-10 px-3 border-b border-[var(--border-subtle)]">
          <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-tertiary)]">Inspector</span>
          <button onClick={() => setIsInspectorOpen(false)} className="p-1 hover:bg-white/5 rounded text-[var(--text-secondary)]" aria-label="Close inspector">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        {aiError && (
          <div className="mx-3 mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 flex items-center justify-between">
            <span>{aiError}</span>
            <button onClick={() => setAiError(null)} className="ml-2 p-0.5 text-red-400 hover:text-red-200"><XMarkIcon className="h-3 w-3" /></button>
          </div>
        )}
        <BookInspector
          book={safeBook}
          activeChapter={activeChapter}
          onUpdateChapter={(chapterId, updates) => updateChapterMutation.mutate({ chapterId, updates })}
          onExportBook={exportBook}
          onCheckConsistency={checkConsistency}
          onContinueNarrative={continueNarrative}
          onSuggestChapterTitle={suggestChapterTitle}
          isNarrativeRunning={isNarrativeRunning}
          isTitleLoading={isTitleLoading}
          exportStatus={exportStatus ?? undefined}
          onUpdateBookMeta={(updates) => updateBookMetaMutation.mutate(updates)}
        />
        </>
        )}
      </div>
    </div>
  );
}
