"use client";

import { useMemo, useEffect, useState, useRef, useCallback, useReducer } from "react";
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
  const canRunAi = instruction.trim().length > 0 && !isRunningAi;

  const runAi = async () => {
    if (!canRunAi) return;
    setIsRunningAi(true);
    dispatchAi({ type: "START_STREAMING" });
    try {
      const response = await fetch(`/api/bff/ai/documents/${documentId}/instruction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      if (!response.ok) throw new Error("AI instruction failed");
      const data = await response.json();
      setActiveAiLog({
        id: data.log_id,
        instruction,
        status: "pending_review",
        created_at: new Date().toISOString(),
        tool_calls: data.tool_calls || [],
        diff_snapshot: data.diff_snapshot,
      });
      setInstruction("");
      dispatchAi({ type: "FINISH_STREAMING" });
      toast("AI suggestion ready — review and insert below.", "info");
    } finally {
      setIsRunningAi(false);
    }
  };

  const acceptAi = async () => {
    if (!activeAiLog) return;
    dispatchAi({ type: "START_APPLYING", changedBlockCount: 1, affectedPageCount: 1 });
    try {
      const response = await fetch(`/api/bff/ai/logs/${activeAiLog.id}/accept`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (data.document_model) setCurrentModel(normalizeModelForEditor(data.document_model, documentId));
      setActiveAiLog(null);
      dispatchAi({ type: "FINISH_APPLYING" });
      toast("AI suggestion inserted", "success");
    } catch {
      toast("Failed to apply AI suggestion", "error");
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
    try {
      const response = await fetch(`/api/bff/ai/documents/${documentId}/summarise`, { method: "POST" });
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
    } finally {
      setIsRunningAi(false);
    }
  };

  const runDetectPii = async () => {
    dispatchAi({ type: "START_STREAMING" });
    try {
      const response = await fetch(`/api/bff/ai/documents/${documentId}/detect-pii`, { method: "POST" });
      if (!response.ok) throw new Error("PII detection failed");
      const data = await response.json();
      const count = data.count || data.findings?.length || 0;
      if (count > 0) {
        toast(`PII detected in ${count} block${count !== 1 ? "s" : ""}. Check document.`, "info");
      } else {
        toast("No PII detected.", "info");
      }
    } finally {
      dispatchAi({ type: "RESET" });
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
  const [leftTab, setLeftTab] = useState<"outline" | "pages">("outline");
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<"assistant" | "themes">("assistant");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
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
    <div className="flex h-screen w-full overflow-x-auto overflow-y-hidden bg-black text-[#ededed]">
      {isOutlineOpen && <aside className="z-20 hidden w-[240px] shrink-0 flex-col border-r border-white/[0.08] bg-black/40 backdrop-blur-2xl lg:flex 2xl:w-[260px]">
        <div className="flex h-14 items-center border-b border-white/[0.08] px-3">
          <Link href="/dashboard" className="mr-2 rounded-md p-1.5 text-[#888] transition-colors hover:bg-white/[0.05] hover:text-white">
            <ChevronLeftIcon className="h-4 w-4" />
          </Link>
          <span className="text-xs font-medium tracking-wide text-[#aaa]">Outline</span>
          <button
            onClick={() => setIsOutlineOpen(false)}
            className="ml-auto rounded p-1 text-[#777] transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Hide outline"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-white/[0.08] p-2">
          <button
            onClick={() => setLeftTab("outline")}
            className={`flex flex-1 items-center justify-center gap-2 rounded py-1.5 text-xs font-medium transition-colors ${
              leftTab === "outline" ? "bg-[#222] text-white" : "text-[#888] hover:bg-[#111] hover:text-white"
            }`}
          >
            <Bars3BottomLeftIcon className="h-3.5 w-3.5" /> Outline
          </button>
          <button
            onClick={() => setLeftTab("pages")}
            className={`flex flex-1 items-center justify-center gap-2 rounded py-1.5 text-xs font-medium transition-colors ${
              leftTab === "pages" ? "bg-[#222] text-white" : "text-[#888] hover:bg-[#111] hover:text-white"
            }`}
          >
            <PhotoIcon className="h-3.5 w-3.5" /> Pages
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
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
          <div className="relative pl-3 border-l border-[var(--border-subtle)]">
            {outlineItems.length > 0 && activeSectionId && (
              <div
                className="absolute left-[-1px] w-[2px] bg-[var(--accent)] transition-all duration-300 ease-out rounded-full"
                style={{ top: calculateTopPosition(activeSectionId), height: 24 }}
              />
            )}
            <div className="space-y-0.5">
              {outlineItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => scrollToOutlineItem(item)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--bg-elevated)] ${
                    activeSectionId === item.id
                      ? "text-[var(--text-primary)] font-medium"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  }`}
                  style={{ height: ITEM_HEIGHT }}
                >
                  <span className={`flex h-3 w-3 items-center justify-center rounded-sm border text-[8px] transition-colors ${
                    activeSectionId === item.id
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : "border-[#444] bg-[var(--bg-panel)] text-[var(--text-tertiary)] group-hover:border-orange-500 group-hover:text-orange-500"
                  }`}>
                    {item.type}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.pageIndex >= 0 && (
                    <span className="shrink-0 text-[9px] font-mono text-[var(--text-tertiary)] opacity-60 group-hover:opacity-100 transition-opacity">
                      p.{item.pageIndex + 1}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}
          {leftTab === "outline" && outlineItems.length === 0 && <p className="px-2 py-2 text-xs text-[var(--text-tertiary)]">No blocks yet.</p>}
        </div>
      </aside>}

      <main className="relative flex min-w-[720px] flex-1 flex-col xl:min-w-[860px]">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />

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
                className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors active:scale-[0.98] ${
                  isOutlineOpen
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                    : "border-[#333] bg-[#0A0A0A] text-[#888] hover:bg-[#111] hover:text-white"
                }`}
              >
                <Bars3BottomLeftIcon className="h-3.5 w-3.5" /> Outline
              </button>
            </GlassTooltip>
          }
          rightSlot={
            <>
              <GlassTooltip label={isSidebarOpen ? "Hide assistant" : "Show assistant"}>
                <button
                  onClick={() => setIsSidebarOpen((open) => !open)}
                  className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors active:scale-[0.98] ${
                    isSidebarOpen
                      ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                      : "border-[#333] bg-[#0A0A0A] text-[#888] hover:bg-[#111] hover:text-white"
                  }`}
                >
                  <SparklesIcon className="h-3.5 w-3.5" /> AI
                </button>
              </GlassTooltip>
              <GlassTooltip label="Scan for PII">
                <button
                  onClick={runDetectPii}
                  className="flex h-8 items-center gap-1 rounded-md border border-[#333] bg-[#0A0A0A] px-2 text-[11px] text-[#888] transition-colors hover:bg-[#111] hover:text-white active:scale-[0.98]"
                >
                  PII
                </button>
              </GlassTooltip>
              <GlassTooltip label="Share" shortcut="⌘S">
                <button onClick={() => void shareEditor()} className="flex h-8 w-8 items-center justify-center rounded-md border border-[#333] bg-[#0A0A0A] text-[#888] transition-colors hover:bg-[#111] active:scale-[0.98]">
                  <ShareIcon className="h-4 w-4" />
                </button>
              </GlassTooltip>
              <GlassTooltip label="Publish to web">
                <button onClick={() => toast("Publish is not enabled yet", "info")} className="ml-2 flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-semibold text-black shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all hover:bg-[#e5e5e5] active:scale-[0.98]">
                  <PlayIcon className="h-3.5 w-3.5" /> Publish
                </button>
              </GlassTooltip>
            </>
          }
        />

        <div className="mx-auto w-full max-w-[1200px] px-4 pt-2">
          <AIStatusHelper
            phase={aiState.phase}
            toolLabels={toolCallSummary}
            onApply={() => void acceptAi()}
            onViewDiff={() => {}}
            onUndo={() => dispatchAi({ type: "REVERT" })}
            onDismiss={() => dispatchAi({ type: "RESET" })}
          />
        </div>

        <AIApplyEffectsLayer phase={aiState.phase} profile={animationProfile} />
        <div ref={editorContentRef} className="relative z-20 min-h-0 flex-1 overflow-hidden">
          {!currentModel ? (
            <div className="flex h-full w-full items-center justify-center bg-black/20 text-xs font-semibold uppercase tracking-[0.18em] text-[#777]">
              Loading editor
            </div>
          ) : editorSurface === "pdf_canvas" || layoutMode === "fidelity" ? (
            <FidelityCanvas documentId={documentId} model={currentModel} onModelChange={setCurrentModel} onNativeOperation={nativeSessionInfo.appendOperation} onAiLifecycleEvent={dispatchAi} />
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
        className={`z-20 flex shrink-0 flex-col border-l border-white/[0.08] bg-[#050505]/90 backdrop-blur-xl transition-[width] duration-300 ${
          isSidebarOpen ? "w-[300px]" : "w-10"
        }`}
      >
        {!isSidebarOpen ? (
          <button
            onClick={() => { setIsSidebarOpen(true); setActiveRightTab("assistant"); }}
            className="flex h-full w-full items-start justify-center px-2 pt-4 text-[#777] transition-colors hover:bg-white/[0.03] hover:text-white"
            aria-label="Open sidebar"
          >
            <SparklesIcon className="h-4 w-4 text-orange-500/80" />
          </button>
        ) : (
          <>
        <div className="flex h-12 items-center border-b border-white/[0.06] px-2">
          <button
            onClick={() => setActiveRightTab("assistant")}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
              activeRightTab === "assistant"
                ? "text-white"
                : "text-[#555] hover:text-white/70"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            Assistant
          </button>
          <button
            onClick={() => setActiveRightTab("themes")}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              activeRightTab === "themes"
                ? "text-white"
                : "text-[#555] hover:text-white/70"
            }`}
          >
            Themes
          </button>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="ml-auto rounded p-1 text-[#777] transition-colors hover:bg-white/[0.04] hover:text-white"
            aria-label="Collapse sidebar"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        {activeRightTab === "assistant" ? (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-3">
              <div className="flex gap-1 rounded-lg border border-white/[0.08] p-0.5">
                <button
                  onClick={() => setIsChatMode(false)}
                  className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    !isChatMode ? "bg-white/10 text-white" : "text-[#555] hover:text-white/70"
                  }`}
                >
                  Edit
                </button>
                <button
                  onClick={() => setIsChatMode(true)}
                  className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    isChatMode ? "bg-white/10 text-white" : "text-[#555] hover:text-white/70"
                  }`}
                >
                  Q&A
                </button>
              </div>

              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={isChatMode ? "Ask a question about the document..." : "Rewrite, translate, format..."}
                className="min-h-28 w-full resize-none rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5 text-sm text-[#ededed] outline-none transition-all placeholder:text-[#555] focus:border-orange-500/50 focus:bg-white/[0.04]"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={isChatMode ? async () => {
                    setIsRunningAi(true);
                    try {
                      const res = await fetch(`/api/bff/ai/documents/${documentId}/chat`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ instruction }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        toast(data.reply || "No response", "info");
                      }
                      setInstruction("");
                    } finally {
                      setIsRunningAi(false);
                    }
                  } : runAi}
                  disabled={!canRunAi}
                  className="flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isRunningAi ? "Generating..." : isChatMode ? "Ask" : "Run"}
                </button>
                <button
                  onClick={() => setShowHistory(true)}
                  className="rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-[#777] transition-colors hover:border-white/20 hover:text-white"
                >
                  History
                </button>
              </div>

              {!isChatMode && (
                <button
                  onClick={runSummarize}
                  disabled={isRunningAi}
                  className="w-full rounded-md border border-white/[0.08] px-3 py-2 text-xs font-medium text-[#777] transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
                >
                  Summarize document
                </button>
              )}

              <p className="text-[11px] leading-relaxed text-[#555]">
                {isChatMode
                  ? "Ask questions about the document content. No edits are made."
                  : "AI changes open in review before they touch your document."}
              </p>
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
        />
      )}
    </div>
  );
}
