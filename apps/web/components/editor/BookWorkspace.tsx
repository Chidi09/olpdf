"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Bars3CenterLeftIcon, XMarkIcon, BookOpenIcon } from "@heroicons/react/24/outline";
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
    <div className="h-screen w-full flex bg-background overflow-hidden relative">
      {/* Universal Depth Background */}
      <div className="absolute -left-[10%] -top-[10%] h-[40%] w-[30%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute -right-[5%] -bottom-[5%] h-[30%] w-[25%] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

      {isCoverBuilderOpen && (
        <CoverBuilder
          onClose={() => setIsCoverBuilderOpen(false)}
          onSave={(coverUrl) => {
            updateBookMetaMutation.mutate({ cover_url: coverUrl });
            setIsCoverBuilderOpen(false);
          }}
        />
      )}

      {/* Left Sidebar: Library */}
      <div className={cn(
        "transition-all duration-500 border-r liquid-glass liquid-glass-noise z-20",
        isSidebarOpen ? "w-64" : "w-0 overflow-hidden"
      )}>
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

      <div className="flex-1 flex flex-col relative overflow-hidden z-10">
        {/* Workspace Header */}
        <div className="h-14 border-b liquid-glass liquid-glass-noise flex items-center px-6 relative z-30">
          <button onClick={toggleSidebar} className="p-2 hover:bg-accent/10 rounded-xl transition-all active:scale-95 text-text-tertiary hover:text-accent" aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}>
            {isSidebarOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3CenterLeftIcon className="h-5 w-5" />}
          </button>
          <div className="ml-4 flex-1">
            <h1 className="font-sans text-sm font-black text-text-primary uppercase tracking-tight flex items-center gap-2">
              <span className="opacity-40">{book?.title}</span>
              <span className="h-1 w-1 rounded-full bg-border-strong" />
              <span className="italic italic text-accent">{activeChapter?.title || (activeMatterKey ? activeMatterKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "ORCHESTRATOR")}</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn(
              "text-[9px] font-black uppercase px-3 py-1 rounded-full border tracking-widest transition-colors",
              activeChapter?.status === "final" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.1)]" :
              activeChapter?.status === "review" ? "border-amber-500/20 bg-amber-500/10 text-amber-400" :
              "border-border-strong bg-surface text-text-tertiary"
            )}>
              {activeChapter?.status || "draft_v1"}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 lg:p-16 flex justify-center bg-background/50 relative">
          {/* Subtle paper grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(var(--border-subtle)_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

          {selectedDocumentId ? (
            <div className="w-full max-w-4xl bg-white shadow-float min-h-[1100px] rounded-sm overflow-hidden transform transition-transform duration-700 animate-slideUp">
              <CollaborativeEditor documentId={selectedDocumentId} userName={userName} userColor={userColor} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-4 animate-reveal">
              <div className="h-12 w-12 rounded-full border border-border-strong flex items-center justify-center bg-surface">
                 <BookOpenIcon className="h-6 w-6 opacity-20" />
              </div>
              <p className="font-mono text-[10px] uppercase tracking-widest opacity-40">Awaiting chapter selection</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar: Inspector */}
      <div className={cn(
        "border-l liquid-glass transition-all duration-500 flex flex-col z-20",
        isInspectorOpen ? "w-80" : "w-12 overflow-hidden"
      )}>
        {!isInspectorOpen ? (
          <button onClick={() => setIsInspectorOpen(true)} className="flex h-full w-12 items-start justify-center pt-5 text-text-tertiary hover:text-accent transition-colors" aria-label="Open inspector">
            <Bars3CenterLeftIcon className="h-5 w-5" />
          </button>
        ) : (
        <>
        <div className="flex items-center justify-between h-14 px-4 border-b border-border-subtle bg-surface/30">
          <span className="font-mono text-[10px] font-black tracking-widest uppercase text-text-tertiary opacity-60">Engine Inspector</span>
          <button onClick={() => setIsInspectorOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all text-text-tertiary hover:text-red-400" aria-label="Close inspector">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {aiError && (
            <div className="mx-4 mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-400 flex items-start justify-between backdrop-blur-sm animate-reveal">
              <span className="leading-relaxed font-medium">{aiError}</span>
              <button onClick={() => setAiError(null)} className="ml-2 p-1 text-red-500 hover:text-red-300 transition-colors"><XMarkIcon className="h-4 w-4" /></button>
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
        </div>
        </>
        )}
      </div>
    </div>
  );
}
