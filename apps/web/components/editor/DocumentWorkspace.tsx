"use client";

import { useMemo, useEffect, useState, useRef, useCallback, useReducer } from "react";
import { cn } from "@/lib/utils";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import dynamic from "next/dynamic";
import Link from "next/link";
import ExportButton from "@/components/ExportButton";
import AiEditDiffPanel from "@/components/editor/AiEditDiffPanel";
import AiHistoryPanel from "@/components/editor/AiHistoryPanel";
import { useDocumentQuery, useSaveDocumentMutation } from "@/hooks/useDocumentQueries";
import { useInstalledPlugins } from "@/hooks/usePlugins";
import { PluginHost } from "./PluginHost";
import ThemePanel from "@/components/editor/ThemePanel";
import { useEditorStore } from "@/store/useEditorStore";
import { useToastStore } from "@/store/useToastStore";
import { normalizeDocumentBlocks } from "@/lib/documentTransformers";
import { useEditorProfile } from "@/hooks/useEditorProfile";
import { useDocumentExport } from "@/components/editor/export/useDocumentExport";
import type { ExportTelemetryPayload } from "@/components/editor/export/types";
import { useNativePdfSession } from "@/hooks/useNativePdfSession";
import { getNativeSession } from "@/lib/nativePdf/documentModelAdapter";
import type { PdfEditOperation } from "@/types/nativePdf";
import { pageLayoutFromDocumentModel } from "@/lib/pageLayout/fromNativePdf";
import type { PageLayoutDocument } from "@/types/pageLayout";
import { usePageLayoutStore } from "@/store/usePageLayoutStore";
import { aiApplyReducer, initialAiApplyState } from "@/components/editor/ai/aiApplyState";
import { resolveAnimationProfile } from "@/components/editor/ai/aiAnimationPolicy";
import AIApplyEffectsLayer from "@/components/editor/ai/AIApplyEffectsLayer";
import AIStatusHelper from "@/components/editor/ai/AIStatusHelper";
import PageThumbnailRail from "@/components/editor/PageThumbnailRail";
import {
  Bars3BottomLeftIcon,
  PhotoIcon,
  SparklesIcon,
  ChevronLeftIcon,
  PlayIcon,
  ShareIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { InlineSpinner } from "@/components/ui/MicroUI";
import { GlassTooltip } from "@/components/ui/GlassTooltip";
import EditorCommandBar from "@/components/editor/EditorCommandBar";
import { shouldShowCanvasToolbarHost } from "@/components/editor/canvasToolbarPlacement";

export { shouldShowCanvasToolbarHost };

const CollaborativeEditor = dynamic(() => import("@/components/CollaborativeEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-base)]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-subtle)] border-t-[var(--accent)]" />
        <p className="text-sm font-bold tracking-widest uppercase text-[var(--text-tertiary)]">Loading Studio Editor...</p>
      </div>
    </div>
  ),
});

const FidelityCanvas = dynamic(() => import("@/components/editor/FidelityCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-surface)]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-subtle)] border-t-[var(--accent)]" />
        <p className="text-sm font-bold tracking-widest uppercase text-[var(--text-tertiary)]">Loading Fidelity Canvas...</p>
      </div>
    </div>
  ),
});

type AiLog = {
  id: string;
  instruction: string;
  status: "pending_review" | "accepted" | "rejected";
  created_at: string;
  tool_calls: Array<{ name: string; args: Record<string, unknown> }>;
  diff_snapshot?: { before: DocumentBlock[]; after: DocumentBlock[] };
};

interface DocumentWorkspaceProps {
  documentId: string;
}

export function isImportedPdfDocument(model: DocumentModel | null | undefined): boolean {
  const meta = model?.meta as Record<string, unknown> | undefined;
  return meta?.native_pdf === true || typeof meta?.original_pdf_key === "string";
}

export type EditorSurface = "pdf_canvas" | "writer";

export function resolveEditorSurface(model: DocumentModel | null | undefined): EditorSurface {
  return isImportedPdfDocument(model) ? "pdf_canvas" : "writer";
}

function normalizeModelForEditor(model: DocumentModel, documentId: string): DocumentModel {
  return {
    ...model,
    id: model.id || documentId,
    blocks: normalizeDocumentBlocks(model.blocks as unknown as Array<Record<string, unknown>>) as unknown as DocumentBlock[],
    page_dimensions: Array.isArray(model.page_dimensions) ? model.page_dimensions : [],
    styles: model.styles || {},
  };
}

export default function DocumentWorkspace({ documentId }: DocumentWorkspaceProps) {
  const documentQuery = useDocumentQuery(documentId);
  const {
    instruction,
    currentModel,
    isRunningAi,
    showHistory,
    activeAiLog,
    setInstruction,
    setCurrentModel,
    setIsRunningAi,
    setShowHistory,
    setActiveAiLog,
  } = useEditorStore();

  const saveMutation = useSaveDocumentMutation(documentId);
  const workspaceId = documentQuery.data?.workspace_id;
  const { data: installedPlugins } = useInstalledPlugins(workspaceId ?? "");

  // Update store model when data arrives. Use a ref instead of `currentModel` in
  // deps — a server doc whose model.id doesn't match the URL documentId would
  // otherwise loop (id stays mismatched after every set, so the guard never trips).
  const hydratedDataRef = useRef<unknown>(null);
  useEffect(() => {
    const data = documentQuery.data;
    if (data?.document_model && hydratedDataRef.current !== data) {
      hydratedDataRef.current = data;
      setCurrentModel(normalizeModelForEditor(data.document_model, documentId));
    }
  }, [documentQuery.data, documentId, setCurrentModel]);

  const [isChatMode, setIsChatMode] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const canRunAi = instruction.trim().length > 0 && !isRunningAi;
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  const cancelAiRequest = () => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
      setIsRunningAi(false);
      dispatchAi({ type: "RESET" });
      toast("AI request cancelled", "info");
    }
  };

  const undoAi = async () => {
    if (!activeAiLog) return;
    dispatchAi({ type: "START_APPLYING", changedBlockCount: 1, affectedPageCount: 1 });
    try {
      await fetch(`/api/bff/ai/logs/${activeAiLog.id}/reject`, { method: "POST" });
      const res = await fetch(`/api/bff/documents/${documentId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.document_model) setCurrentModel(normalizeModelForEditor(data.document_model, documentId));
      }
      setActiveAiLog(null);
      dispatchAi({ type: "RESET" });
      toast("AI suggestion reverted", "success");
    } catch {
      toast("Failed to revert AI suggestion", "error");
      dispatchAi({ type: "RESET" });
    }
  };

  const runAi = async () => {
    if (!canRunAi) return;
    setIsRunningAi(true);
    dispatchAi({ type: "START_STREAMING" });

    aiAbortControllerRef.current = new AbortController();

    try {
      const endpoint = isChatMode
        ? `/api/bff/ai/documents/${documentId}/chat`
        : `/api/bff/ai/documents/${documentId}/instruction`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
        signal: aiAbortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("AI request failed");
      const data = await response.json();

      if (isChatMode) {
        setChatHistory((prev) => [
          ...prev,
          { role: "user", text: instruction },
          { role: "assistant", text: data.reply || "Chat response received." }
        ]);
        dispatchAi({ type: "RESET" });
      } else {
        setActiveAiLog({
          id: data.log_id,
          instruction,
          status: "pending_review",
          created_at: new Date().toISOString(),
          tool_calls: data.tool_calls || [],
          diff_snapshot: data.diff_snapshot,
        });
        toast("AI suggestion ready — review and insert below.", "info");
        dispatchAi({ type: "FINISH_STREAMING" });
      }
      setInstruction("");
    } catch (err: any) {
      if (err.name === "AbortError") return;
      toast("Failed to complete AI request.", "error");
      dispatchAi({ type: "RESET" });
    } finally {
      setIsRunningAi(false);
      aiAbortControllerRef.current = null;
    }
  };

  const acceptAi = async () => {
    if (!activeAiLog) return;
    dispatchAi({ type: "START_APPLYING", changedBlockCount: 1, affectedPageCount: 1 });
    try {
      const response = await fetch(`/api/bff/ai/logs/${activeAiLog.id}/accept`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (data.document_model) setCurrentModel(normalizeModelForEditor(data.document_model, documentId));
      dispatchAi({ type: "FINISH_APPLYING" });
      toast("AI suggestion inserted", "success");
    } catch {
      toast("Failed to apply AI suggestion", "error");
      dispatchAi({ type: "RESET" });
    }
  };

  const rejectAi = async () => {
    if (!activeAiLog) return;
    try {
      await fetch(`/api/bff/ai/logs/${activeAiLog.id}/reject`, { method: "POST" });
      setActiveAiLog(null);
      dispatchAi({ type: "RESET" });
      toast("AI suggestion rejected", "info");
    } catch {
      setActiveAiLog(null);
    }
  };

  const runSummarize = async () => {
    setIsRunningAi(true);
    dispatchAi({ type: "START_STREAMING" });

    aiAbortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/bff/ai/documents/${documentId}/summarise`, {
        method: "POST",
        signal: aiAbortControllerRef.current.signal,
      });
      if (!response.ok) throw new Error("Summarize failed");
      const data = await response.json();
      const summaryText = data.summary || data.updated_model?.blocks?.[0]?.content || "";
      if (data.log_id) {
        setActiveAiLog({
          id: data.log_id,
          instruction: "Summarize document",
          status: "pending_review",
          created_at: new Date().toISOString(),
          tool_calls: data.tool_calls || [{ name: "RewriteBlock", args: {} }],
          diff_snapshot: data.diff_snapshot,
        });
      } else if (summaryText) {
        toast(summaryText, "info");
      }
      dispatchAi({ type: "FINISH_STREAMING" });
    } catch (err: any) {
      if (err.name === "AbortError") return;
      toast("Failed to summarize document.", "error");
      dispatchAi({ type: "RESET" });
    } finally {
      setIsRunningAi(false);
      aiAbortControllerRef.current = null;
    }
  };

  const runDetectPii = async () => {
    dispatchAi({ type: "START_STREAMING" });

    aiAbortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/bff/ai/documents/${documentId}/detect-pii`, {
        method: "POST",
        signal: aiAbortControllerRef.current.signal,
      });
      if (!response.ok) throw new Error("PII detection failed");
      const data = await response.json();
      const count = data.count || data.findings?.length || 0;
      if (count > 0) {
        toast(`PII detected in ${count} block${count !== 1 ? "s" : ""}. Check document.`, "info");
      } else {
        toast("No PII detected.", "info");
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      toast("Failed to detect PII.", "error");
    } finally {
      dispatchAi({ type: "RESET" });
      aiAbortControllerRef.current = null;
    }
  };

  const toolCallSummary = useMemo(() => {
    if (!activeAiLog?.tool_calls?.length) return "";
    const names = activeAiLog.tool_calls.map((tc) => {
      const n = tc.name;
      if (n === "RewriteBlock") return "Rewrite";
      if (n === "InsertBlock") return "Insert";
      if (n === "DeleteBlock") return "Delete";
      if (n === "ReorderBlocks") return "Reorder";
      if (n === "ApplyTheme") return "Theme";
      if (n === "TranslateBlocks") return "Translate";
      if (n === "MergeBlocks") return "Merge";
      if (n === "SplitBlock") return "Split";
      if (n === "DuplicateBlock") return "Duplicate";
      if (n === "CompressContent") return "Compress";
      if (n === "ExpandContent") return "Expand";
      if (n === "ChangeBlockType") return "Change type";
      if (n === "SetBlockStyle") return "Style";
      if (n === "SetInlineFormat") return "Format";
      if (n === "InsertTOC") return "TOC";
      if (n === "GenerateTable") return "Table";
      return n;
    });
    const counts: Record<string, number> = {};
    names.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
    return Object.entries(counts)
      .map(([k, v]) => (v > 1 ? `${k} x${v}` : k))
      .join(", ");
  }, [activeAiLog?.tool_calls]);

  const aiDiff = useMemo(() => {
    if (!activeAiLog?.diff_snapshot) return null;
    return activeAiLog.diff_snapshot;
  }, [activeAiLog]);

  const nativeSessionInfo = useNativePdfSession(documentId, currentModel);
  const nativeSession = getNativeSession(currentModel);
  const nativeSessionReady = nativeSession?.status === "ready" || nativeSession?.status === "partial";

  const editorSurface = resolveEditorSurface(currentModel);

  const layoutDocument: PageLayoutDocument | null = useMemo(() => {
    if (editorSurface !== "pdf_canvas" || !currentModel) return null;
    return pageLayoutFromDocumentModel(currentModel);
  }, [currentModel, editorSurface]);

  const setPageLayoutDoc = usePageLayoutStore((s) => s.setDocument);
  const prevLayoutRef = useRef<string | null>(null);
  useEffect(() => {
    if (editorSurface === "pdf_canvas" && layoutDocument) {
      const key = layoutDocument.pages.map((p) => p.id).join(",");
      if (prevLayoutRef.current !== key) {
        prevLayoutRef.current = key;
        setPageLayoutDoc(layoutDocument);
      }
    } else if (editorSurface !== "pdf_canvas") {
      prevLayoutRef.current = null;
      setPageLayoutDoc(null);
    }
  }, [layoutDocument, editorSurface, setPageLayoutDoc]);

  const hasAbsolutePdfLayout = Boolean(
    currentModel?.page_dimensions?.length || currentModel?.blocks?.some((block) => Array.isArray(block.bounding_box)),
  );
  const canUseFidelity = !isImportedPdfDocument(currentModel) && (
    nativeSessionReady || Boolean(currentModel?.page_dimensions?.length && currentModel?.blocks?.some((block) => Array.isArray(block.bounding_box)))
  );
  const layoutMode = editorSurface === "pdf_canvas" ? "fidelity" : (
    (nativeSessionReady && currentModel?.meta?.layout_mode === undefined) ? "fidelity" : (currentModel?.meta?.layout_mode ?? (hasAbsolutePdfLayout ? "fidelity" : "editable"))
  );
  const showCanvasToolbarHost = shouldShowCanvasToolbarHost(editorSurface, layoutMode, Boolean(currentModel));
  const [leftTab, setLeftTab] = useState<"outline" | "pages">("outline");
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<"assistant" | "themes">("assistant");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [canvasToolbarHost, setCanvasToolbarHost] = useState<HTMLDivElement | null>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const toast = useToastStore((s) => s.toast);
  const editorProfile = useEditorProfile();
  const [aiState, dispatchAi] = useReducer(aiApplyReducer, initialAiApplyState);
  const animationProfile = resolveAnimationProfile({
    changedBlockCount: aiState.changedBlockCount,
    affectedPageCount: aiState.affectedPageCount,
    isReducedMotion: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });

  const exportHook = useDocumentExport({
    documentId,
    getModel: useCallback(() => currentModel, [currentModel]),
    flushSave: useCallback(async () => {
      if (currentModel) await saveMutation.mutateAsync(currentModel);
    }, [currentModel, saveMutation]),
    onTelemetry: useCallback((payload: ExportTelemetryPayload) => {
      console.log("[export-telemetry]", payload);
    }, []),
  });

  useEffect(() => {
    if (exportHook.phase === "success") {
      toast("PDF export started", "success");
    } else if (exportHook.phase === "error" && exportHook.error) {
      toast(exportHook.error, "error");
    }
  }, [exportHook.phase, exportHook.error, toast]);

  useEffect(() => {
    setTitleDraft(currentModel?.meta?.title || "Untitled Document");
  }, [currentModel?.meta?.title]);

  const outlineItems = useMemo(() => {
    const blocks = currentModel?.blocks || [];
    return blocks.slice(0, 24).map((b, index) => {
      const rawContent = b.content as unknown;
      const text = String(
        rawContent && typeof rawContent === "object" && "text" in rawContent
          ? (rawContent as { text?: unknown }).text || ""
          : rawContent || "",
      ).trim();
      const label = text || `Block ${index + 1}`;
      const type = String((b as { type?: string }).type || "p").toUpperCase().slice(0, 2);
      const pageIdx = (b as { page_index?: number }).page_index;
      return { id: b.id, label, type, pageIndex: pageIdx ?? -1 };
    });
  }, [currentModel?.blocks]);

  const scrollToOutlineItem = useCallback((item: { id: string; label: string; pageIndex: number }) => {
    if (layoutMode === "fidelity" && item.pageIndex >= 0) {
      const el = document.querySelector(`[data-page-index="${item.pageIndex}"]`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    }

    const pm = document.querySelector(".ProseMirror");
    if (pm) {
      const byBlockId = pm.querySelector(`[data-block-id="${item.id}"]`);
      if (byBlockId) { byBlockId.scrollIntoView({ behavior: "smooth", block: "center" }); return; }

      const headings = pm.querySelectorAll("h1, h2, h3, h4, h5, h6");
      for (const h of headings) {
        if (h.textContent?.trim() === item.label) {
          h.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
    }
  }, [layoutMode]);

  const ITEM_HEIGHT = 36;

  const calculateTopPosition = useCallback((id: string) => {
    const idx = outlineItems.findIndex((item) => item.id === id);
    return idx >= 0 ? idx * ITEM_HEIGHT + 8 : 0;
  }, [outlineItems]);

  useEffect(() => {
    if (layoutMode === "fidelity") return;

    const findProseMirror = () => document.querySelector(".ProseMirror");
    let observer: IntersectionObserver | null = null;

    const setupObserver = () => {
      const pm = findProseMirror();
      if (!pm) return;

      const headings = pm.querySelectorAll("h1, h2, h3, h4, h5, h6");
      if (headings.length === 0) return;

      const idToEl = new Map<string, Element>();
      headings.forEach((h) => {
        const text = h.textContent?.trim() || "";
        const block = outlineItems.find((item) => item.label === text);
        if (block) idToEl.set(block.id, h);
      });

      const visible = new Map<string, number>();

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            let matchedId: string | null = null;
            idToEl.forEach((el, id) => {
              if (el === entry.target) matchedId = id;
            });
            if (!matchedId) return;
            if (entry.isIntersecting) {
              visible.set(matchedId, entry.intersectionRatio);
            } else {
              visible.delete(matchedId);
            }
          });

          let bestId: string | null = null;
          let bestRatio = 0;
          visible.forEach((ratio, id) => {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              bestId = id;
            }
          });

          if (bestId) setActiveSectionId(bestId);
        },
        { threshold: [0, 0.25, 0.5, 0.75, 1] },
      );

      headings.forEach((h) => observer?.observe(h));
    };

    const mo = new MutationObserver(() => {
      observer?.disconnect();
      setupObserver();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(setupObserver, 300);

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      mo.disconnect();
    };
  }, [layoutMode, outlineItems]);

  const setLayoutMode = async (mode: "editable" | "fidelity") => {
    if (!currentModel || layoutMode === mode) return;
    await nativeSessionInfo.flushOperations();
    const nextModel: DocumentModel = {
      ...currentModel,
      meta: { ...currentModel.meta, title: currentModel.meta?.title || "Untitled Document", layout_mode: mode },
    };
    setCurrentModel(nextModel);
    await saveMutation.mutateAsync(nextModel);
  };

  const shareEditor = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    toast("Editor link copied", "success");
  };

  return (
    <div className="flex h-screen w-full overflow-x-auto overflow-y-hidden bg-black text-text-primary selection:bg-accent/30 relative">
      {/* Background Depth */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none" />

      {isOutlineOpen && <aside className="z-20 hidden w-[240px] shrink-0 flex-col liquid-glass liquid-glass-noise lg:flex 2xl:w-[260px] border-r">
        <div className="flex h-14 items-center border-b border-white/[0.08] px-4 bg-surface/30">
          <Link href="/dashboard" className="mr-3 rounded-lg p-1.5 text-text-tertiary transition-all hover:bg-accent/10 hover:text-accent active:scale-90">
            <ChevronLeftIcon className="h-4 w-4" />
          </Link>
          <span className="font-mono text-[10px] font-black uppercase tracking-widest text-text-tertiary opacity-60">Structure</span>
          <button
            onClick={() => setIsOutlineOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-text-tertiary transition-all hover:bg-white/5 hover:text-white"
            aria-label="Hide outline"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-white/[0.08] p-2 bg-black/20">
          <button
            onClick={() => setLeftTab("outline")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
              leftTab === "outline" ? "bg-accent text-white shadow-lg shadow-accent/10" : "text-text-tertiary hover:bg-white/5 hover:text-text-secondary"
            )}
          >
            <Bars3BottomLeftIcon className="h-3.5 w-3.5" /> Outline
          </button>
          <button
            onClick={() => setLeftTab("pages")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
              leftTab === "pages" ? "bg-accent text-white shadow-lg shadow-accent/10" : "text-text-tertiary hover:bg-white/5 hover:text-text-secondary"
            )}
          >
            <PhotoIcon className="h-3.5 w-3.5" /> Pages
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {leftTab === "pages" ? (
            <PageThumbnailRail
              pageDimensions={currentModel?.page_dimensions ?? []}
              activePageIndex={undefined}
              onSelectPage={(idx) => {
                const el = document.querySelector(`[data-page-index="${idx}"]`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              onReorderPages={(from, to) => {
                if (usePageLayoutStore.getState().document) {
                  usePageLayoutStore.getState().reorderPages(from, to);
                }
              }}
            />
          ) : (
          <div className="relative pl-3 border-l border-border-subtle/50 ml-1 mt-2">
            {outlineItems.length > 0 && activeSectionId && (
              <div
                className="absolute left-[-1px] w-[2px] bg-accent transition-all duration-300 ease-out rounded-full shadow-[0_0_8px_var(--accent)]"
                style={{ top: calculateTopPosition(activeSectionId), height: 24 }}
              />
            )}
            <div className="space-y-1">
              {outlineItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => scrollToOutlineItem(item)}
                  className={cn(
                    "group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-xs transition-all hover:bg-surface/80",
                    activeSectionId === item.id
                      ? "text-text-primary font-bold bg-accent/5"
                      : "text-text-tertiary hover:text-text-secondary"
                  )}
                  style={{ height: ITEM_HEIGHT }}
                >
                  <span className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border text-[7px] font-black transition-all",
                    activeSectionId === item.id
                      ? "border-accent bg-accent text-white shadow-sm"
                      : "border-border-strong bg-background text-text-tertiary group-hover:border-accent/60"
                  )}>
                    {item.type.charAt(0)}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.pageIndex >= 0 && (
                    <span className="shrink-0 font-mono text-[9px] text-text-tertiary opacity-40 group-hover:opacity-100 transition-opacity">
                      {item.pageIndex + 1}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}
          {leftTab === "outline" && outlineItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 opacity-30 gap-2">
               <Bars3BottomLeftIcon className="h-5 w-5" />
               <p className="font-mono text-[9px] uppercase tracking-widest">Null Set</p>
            </div>
          )}
        </div>
      </aside>}

      <main className="relative flex min-w-[720px] flex-1 flex-col xl:min-w-[860px] z-10">
        <EditorCommandBar
          mode={layoutMode}
          title={titleDraft}
          isSaving={saveMutation.isPending}
          canUseFidelity={canUseFidelity}
          showModeToggle={editorSurface !== "pdf_canvas"}
          nativeSessionStatus={nativeSession?.status}
          onTitleChange={setTitleDraft}
          onTitleBlur={() => {
            if (!currentModel || titleDraft === (currentModel.meta?.title ?? "")) return;
            const nextModel = { ...currentModel, meta: { ...currentModel.meta, title: titleDraft } };
            setCurrentModel(nextModel);
            saveMutation.mutate(nextModel);
          }}
          onModeToggle={() => {
            if (layoutMode === "editable" && !canUseFidelity) {
              if (nativeSession?.status === "parsing") { toast("PDF is still being parsed by the browser engine.", "info"); }
              else if ((currentModel?.meta as Record<string, unknown> | undefined)?.import_status === "processing") { toast("PDF import is still processing.", "info"); }
              else if (nativeSession && !nativeSessionReady) { toast("Native PDF session is not ready yet.", "error"); }
              else { toast("Fidelity view requires page dimensions and block layout data.", "info"); }
              return;
            }
            void setLayoutMode(layoutMode === "editable" ? "fidelity" : "editable");
          }}
          onExport={() => void exportHook.exportNow()}
          isExporting={exportHook.isExporting}
          leftSlot={
            <GlassTooltip label={isOutlineOpen ? "Hide outline" : "Show outline"}>
              <button
                onClick={() => setIsOutlineOpen((open) => !open)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-xl border px-4 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                  isOutlineOpen
                    ? "border-accent/40 bg-accent/10 text-accent shadow-sm shadow-accent/5"
                    : "border-border-strong bg-surface text-text-tertiary hover:bg-hover hover:text-text-primary"
                )}
              >
                <Bars3BottomLeftIcon className="h-4 w-4" /> Outline
              </button>
            </GlassTooltip>
          }
          rightSlot={
            <div className="flex items-center gap-2">
              <GlassTooltip label={isSidebarOpen ? "Hide assistant" : "Show assistant"}>
                <button
                  onClick={() => setIsSidebarOpen((open) => !open)}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-xl border px-4 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                    isSidebarOpen
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-border-strong bg-surface text-text-tertiary hover:bg-hover hover:text-text-primary"
                  )}
                >
                  <SparklesIcon className="h-4 w-4" /> AI
                </button>
              </GlassTooltip>

              <div className="h-4 w-px bg-border-subtle mx-1" />

              <GlassTooltip label="Scan for PII">
                <button
                  onClick={runDetectPii}
                  className="flex h-9 items-center gap-2 rounded-xl border border-border-strong bg-surface px-3 font-mono text-[10px] font-black text-text-tertiary transition-all hover:bg-hover hover:text-text-primary active:scale-95"
                >
                  PII
                </button>
              </GlassTooltip>
              <GlassTooltip label="Share" shortcut="⌘S">
                <button onClick={() => void shareEditor()} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-strong bg-surface text-text-tertiary transition-all hover:bg-hover hover:text-text-primary active:scale-95">
                  <ShareIcon className="h-4 w-4" />
                </button>
              </GlassTooltip>
              <button onClick={() => toast("Publish is not enabled yet", "info")} className="ml-2 flex h-9 items-center gap-2 rounded-xl bg-white px-5 text-[10px] font-black uppercase tracking-[0.15em] text-black shadow-xl shadow-white/5 transition-all hover:brightness-110 active:scale-95">
                <PlayIcon className="h-4 w-4" /> Publish
              </button>
            </div>
          }
        />

        <div className="mx-auto w-full max-w-[1200px] px-6 pt-3 relative z-30">
          {showCanvasToolbarHost && <div ref={setCanvasToolbarHost} className="mb-3" />}
          <AIStatusHelper
            phase={aiState.phase}
            toolLabels={toolCallSummary}
            onApply={() => void acceptAi()}
            onViewDiff={() => {}}
            onUndo={() => void undoAi()}
            onCancel={cancelAiRequest}
            onDismiss={() => dispatchAi({ type: "RESET" })}
          />
        </div>

        <AIApplyEffectsLayer phase={aiState.phase} profile={animationProfile} />

        <div ref={editorContentRef} className="relative z-20 min-h-0 flex-1 overflow-hidden transition-all duration-700">
          {!currentModel ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-text-tertiary">
              <InlineSpinner className="h-6 w-6 text-accent" />
              <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Initializing Kernel</span>
            </div>
          ) : editorSurface === "pdf_canvas" || layoutMode === "fidelity" ? (
            <FidelityCanvas
              documentId={documentId}
              model={currentModel}
              toolbarHost={showCanvasToolbarHost ? canvasToolbarHost : undefined}
              onModelChange={setCurrentModel}
              onNativeOperation={nativeSessionInfo.appendOperation}
              onAiLifecycleEvent={dispatchAi}
              highlightBlockIds={aiDiff ? [...aiDiff.before.map(b => b.id), ...aiDiff.after.map(b => b.id)] : undefined}
            />
          ) : (
            <CollaborativeEditor
              documentId={documentId}
              userName={editorProfile.alias}
              userColor={editorProfile.color}
              initialModel={currentModel ?? undefined}
              onModelChange={setCurrentModel}
            />
          )}
        </div>
      </main>

      <aside
        className={cn(
          "z-20 flex shrink-0 flex-col liquid-glass liquid-glass-noise border-l transition-all duration-500 shadow-2xl",
          isSidebarOpen ? "w-[300px]" : "w-12"
        )}
      >
        {!isSidebarOpen ? (
          <button
            onClick={() => { setIsSidebarOpen(true); setActiveRightTab("assistant"); }}
            className="flex h-full w-full items-start justify-center px-2 pt-6 text-text-tertiary transition-all hover:bg-accent/5 hover:text-accent"
            aria-label="Open sidebar"
          >
            <SparklesIcon className="h-5 w-5" />
          </button>
        ) : (
          <>
        <div className="flex h-14 items-center border-b border-white/[0.06] px-3 bg-surface/30">
          <div className="flex gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveRightTab("assistant")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                activeRightTab === "assistant" ? "bg-accent text-white shadow-lg shadow-accent/10" : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              <SparklesIcon className="h-3 w-3" /> Assistant
            </button>
            <button
              onClick={() => setActiveRightTab("themes")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                activeRightTab === "themes" ? "bg-accent text-white shadow-lg shadow-accent/10" : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              Themes
            </button>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="ml-auto rounded-lg p-2 text-text-tertiary transition-all hover:bg-white/5 hover:text-red-400"
            aria-label="Collapse sidebar"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        {activeRightTab === "assistant" ? (
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="space-y-5">
              <div className="flex gap-1 rounded-xl bg-black/40 p-1 border border-white/5">
                <button
                  onClick={() => setIsChatMode(false)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                    !isChatMode ? "bg-white/10 text-white shadow-sm" : "text-text-tertiary hover:text-white/70"
                  )}
                >
                  Engineering
                </button>
                <button
                  onClick={() => setIsChatMode(true)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                    isChatMode ? "bg-white/10 text-white shadow-sm" : "text-text-tertiary hover:text-white/70"
                  )}
                >
                  Analysis
                </button>
              </div>

              {isChatMode && chatHistory.length > 0 && (
                <div className="flex flex-col gap-4 pb-2 animate-reveal">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
                      <div className={cn(
                        "px-4 py-2.5 text-xs rounded-2xl max-w-[92%] leading-relaxed shadow-sm",
                        msg.role === "user"
                          ? "bg-accent/10 border border-accent/20 text-orange-100 rounded-tr-none"
                          : "bg-surface border border-border-subtle text-text-secondary rounded-tl-none"
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isRunningAi && (
                    <div className="flex items-start">
                      <div className="px-4 py-2.5 text-xs rounded-2xl rounded-tl-none bg-surface border border-border-subtle text-text-tertiary animate-pulse flex items-center gap-2">
                        <InlineSpinner className="h-3 w-3" /> Reasoning...
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="relative group">
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder={isChatMode ? "Inquire about document kernel..." : "Synthesize new structures..."}
                  className="min-h-32 w-full resize-none rounded-xl border border-border-strong bg-background/50 p-4 font-sans text-xs text-text-primary outline-none transition-all placeholder:text-text-tertiary focus:border-accent/50 focus:bg-background/80 shadow-inner"
                />
                <div className="absolute bottom-3 right-3 font-mono text-[8px] text-text-tertiary opacity-30 uppercase">prompt_v2.0</div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={runAi}
                  disabled={!canRunAi}
                  className="flex-1 h-10 rounded-xl bg-white px-4 text-[10px] font-black uppercase tracking-widest text-black shadow-lg shadow-white/5 transition-all hover:brightness-110 active:scale-95 disabled:opacity-30"
                >
                  {isRunningAi ? "Synthesizing" : isChatMode ? "Analyze" : "Execute"}
                </button>
                <button
                  onClick={() => setShowHistory(true)}
                  className="h-10 px-4 rounded-xl border border-border-strong bg-surface text-[10px] font-black uppercase tracking-widest text-text-tertiary transition-all hover:border-accent/40 hover:text-accent active:scale-95"
                >
                  Log
                </button>
              </div>

              {!isChatMode && (
                <button
                  onClick={runSummarize}
                  disabled={isRunningAi}
                  className="w-full h-9 rounded-xl border-2 border-dashed border-border-strong px-4 text-[10px] font-black uppercase tracking-widest text-text-tertiary transition-all hover:border-accent/30 hover:text-text-secondary active:scale-[0.98] disabled:opacity-20"
                >
                  Reconstruct Summary
                </button>
              )}

              <div className="p-3 rounded-xl bg-accent/5 border border-accent/10">
                <p className="text-[10px] leading-relaxed text-text-tertiary font-medium">
                  {isChatMode
                    ? "Interactive Q&A mode. The agent provides insights without mutating the document binary."
                    : "Atomic edit mode. All transformations are staged for manual verification before commit."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <ThemePanel
            documentId={documentId}
            currentModel={currentModel}
            onThemeApplied={(logId) => {
              setActiveAiLog({
                id: logId,
                instruction: "Apply theme",
                status: "pending_review",
                created_at: new Date().toISOString(),
                tool_calls: [{ name: "ApplyTheme", args: {} }],
              });
            }}
          />
        )}
          </>
        )}
      </aside>

      {installedPlugins?.map((p: { id: string; bundle_url: string; [k: string]: unknown }) => (
        <PluginHost
          key={p.id}
          bundleUrl={p.bundle_url}
          documentId={documentId}
          blocks={currentModel?.blocks || []}
          onUpdateBlock={(id, content) => {
            if (!currentModel) return;
            const nextBlocks = currentModel.blocks.map((b) => (b.id === id ? { ...b, content } : b));
            const nextModel = { ...currentModel, blocks: nextBlocks };
            setCurrentModel(nextModel);
            saveMutation.mutate(nextModel);
          }}
          onEmitNotification={(_msg, _type) => {
            // Notification handled by system
          }}
        />
      ))}

      {showHistory && (
        <AiHistoryPanel
          documentId={documentId}
          onClose={() => setShowHistory(false)}
          onSelectLog={(log) => {
            setActiveAiLog(log as AiLog);
            setShowHistory(false);
          }}
        />
      )}

      {aiDiff && activeAiLog && (
        <AiEditDiffPanel
          instruction={activeAiLog.instruction}
          before={aiDiff.before}
          after={aiDiff.after}
          onAccept={acceptAi}
          onReject={rejectAi}
          onRefine={(refinement) => {
            setInstruction(refinement);
            void runAi();
          }}
        />
      )}
    </div>
  );
}
