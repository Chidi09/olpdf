"use client";

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import dynamic from "next/dynamic";
import Link from "next/link";
import ExportButton from "@/components/ExportButton";
import AiEditDiffPanel from "@/components/editor/AiEditDiffPanel";
import AiHistoryPanel from "@/components/editor/AiHistoryPanel";
import { useDocumentQuery, useSaveDocumentMutation } from "@/hooks/useDocumentQueries";
import { useInstalledPlugins } from "@/hooks/usePlugins";
import { PluginHost } from "./PluginHost";
import { useEditorStore } from "@/store/useEditorStore";
import { useToastStore } from "@/store/useToastStore";
import { useEditorProfile } from "@/hooks/useEditorProfile";
import {
  Bars3BottomLeftIcon,
  Squares2X2Icon,
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

  // Update store model when data arrives
  useEffect(() => {
    if (documentQuery.data?.document_model && !currentModel) {
      setCurrentModel(documentQuery.data.document_model);
    }
  }, [documentQuery.data, currentModel, setCurrentModel]);

  const canRunAi = instruction.trim().length > 0 && !isRunningAi;

  const runAi = async () => {
    if (!canRunAi) return;
    setIsRunningAi(true);
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
      toast("AI suggestion ready — review and insert below.", "info");
    } finally {
      setIsRunningAi(false);
    }
  };

  const acceptAi = async () => {
    if (!activeAiLog) return;
    try {
      const response = await fetch(`/api/bff/ai/logs/${activeAiLog.id}/accept`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (data.document_model) setCurrentModel(data.document_model);
      setActiveAiLog(null);
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
      toast("AI suggestion rejected", "info");
    } catch {
      setActiveAiLog(null);
    }
  };

  const aiDiff = useMemo(() => {
    if (!activeAiLog?.diff_snapshot) return null;
    return activeAiLog.diff_snapshot;
  }, [activeAiLog]);

  const hasAbsolutePdfLayout = Boolean(
    currentModel?.page_dimensions?.length || currentModel?.blocks?.some((block) => Array.isArray(block.bounding_box)),
  );
  const canUseFidelity = Boolean(currentModel?.page_dimensions?.length && currentModel?.blocks?.some((block) => Array.isArray(block.bounding_box)));
  const layoutMode = currentModel?.meta?.layout_mode ?? (hasAbsolutePdfLayout ? "fidelity" : "editable");
  const [leftTab, setLeftTab] = useState<"outline" | "blocks">("outline");
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const editorContentRef = useRef<HTMLDivElement>(null);
  const toast = useToastStore((s) => s.toast);
  const editorProfile = useEditorProfile();

  useEffect(() => {
    setTitleDraft(currentModel?.meta?.title || "Untitled Document");
  }, [currentModel?.meta?.title]);

  const outlineItems = useMemo(() => {
    const blocks = currentModel?.blocks || [];
    return blocks.slice(0, 24).map((b, index) => {
      const text = String((b as { content?: { text?: string } }).content?.text || "").trim();
      const label = text || `Block ${index + 1}`;
      const type = String((b as { type?: string }).type || "p").toUpperCase().slice(0, 2);
      return { id: b.id, label, type };
    });
  }, [currentModel?.blocks]);

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

  const exportPdf = async () => {
    if (!currentModel || isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch(`/api/bff/documents/${documentId}/export/fidelity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_model: currentModel, font_metrics: {} }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error("export_failed");
      const a = document.createElement("a");
      a.href = data.url;
      a.download = `${currentModel.meta?.title || "document"}.pdf`;
      a.click();
      toast("PDF export started", "success");
    } catch {
      toast("Export failed. Try again after saving.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-x-auto overflow-y-hidden bg-black text-[#ededed]">
      {isOutlineOpen && <aside className="z-20 hidden w-[240px] shrink-0 flex-col border-r border-white/[0.08] bg-black/40 backdrop-blur-2xl lg:flex 2xl:w-[260px]">
        <div className="flex h-14 items-center border-b border-white/[0.08] px-3">
          <Link href="/dashboard" className="mr-2 rounded-md p-1.5 text-[#888] transition-colors hover:bg-white/[0.05] hover:text-white">
            <ChevronLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 overflow-hidden rounded-full border border-white/20">
              <img src={editorProfile.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#aaa]">{editorProfile.alias}</span>
          </div>
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
            onClick={() => setLeftTab("blocks")}
            className={`flex flex-1 items-center justify-center gap-2 rounded py-1.5 text-xs font-medium transition-colors ${
              leftTab === "blocks" ? "bg-[#222] text-white" : "text-[#888] hover:bg-[#111] hover:text-white"
            }`}
          >
            <Squares2X2Icon className="h-3.5 w-3.5" /> Blocks
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
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
                    {leftTab === "outline" ? item.type : "B"}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          {outlineItems.length === 0 && <p className="px-2 py-2 text-xs text-[var(--text-tertiary)]">No blocks yet.</p>}
        </div>
      </aside>}

      <main className="relative flex min-w-[720px] flex-1 flex-col xl:min-w-[860px]">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />

        <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-black/40 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-md p-1.5 text-[#888] transition-colors hover:bg-white/[0.05] hover:text-white" aria-label="Back to dashboard">
              <ChevronLeftIcon className="h-4 w-4" />
            </Link>
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
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                if (!currentModel || titleDraft === (currentModel.meta?.title ?? "")) return;
                const nextModel = { ...currentModel, meta: { ...currentModel.meta, title: titleDraft } };
                setCurrentModel(nextModel);
                saveMutation.mutate(nextModel);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-64 rounded border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-white outline-none transition-all hover:border-[#333] focus:border-orange-500 focus:bg-[#0A0A0A]"
            />
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#666]">
              {saveMutation.isPending ? (
                <><InlineSpinner className="h-3 w-3 text-[#888]" /> Syncing...</>
              ) : (
                <><CheckCircleIcon className="h-3 w-3 text-[#666]" /> Saved</>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <GlassTooltip label={isAssistantOpen ? "Hide assistant" : "Show assistant"}>
              <button
                onClick={() => setIsAssistantOpen((open) => !open)}
                className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors active:scale-[0.98] ${
                  isAssistantOpen
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                    : "border-[#333] bg-[#0A0A0A] text-[#888] hover:bg-[#111] hover:text-white"
                }`}
              >
                <SparklesIcon className="h-3.5 w-3.5" /> AI
              </button>
            </GlassTooltip>
            <GlassTooltip label="Share" shortcut="⌘S">
              <button onClick={() => void shareEditor()} className="flex h-8 w-8 items-center justify-center rounded-md border border-[#333] bg-[#0A0A0A] text-[#888] transition-colors hover:bg-[#111] active:scale-[0.98]">
                <ShareIcon className="h-4 w-4" />
              </button>
            </GlassTooltip>
            <GlassTooltip label="Export PDF">
              <button onClick={() => void exportPdf()} disabled={isExporting || !currentModel} className="flex h-8 items-center gap-1.5 rounded-md border border-[#333] bg-[#0A0A0A] px-3 text-xs font-semibold text-[#ededed] transition-colors hover:bg-[#111] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                {isExporting ? <InlineSpinner className="h-3.5 w-3.5" /> : <ArrowDownTrayIcon className="h-3.5 w-3.5" />} {isExporting ? "Exporting" : "Export"}
              </button>
            </GlassTooltip>
            <GlassTooltip label="Publish to web">
              <button onClick={() => toast("Publish is not enabled yet", "info")} className="ml-2 flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-semibold text-black shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all hover:bg-[#e5e5e5] active:scale-[0.98]">
                <PlayIcon className="h-3.5 w-3.5" /> Publish
              </button>
            </GlassTooltip>
          </div>
        </header>

        <div ref={editorContentRef} className="relative z-20 min-h-0 flex-1 overflow-hidden">
          {!currentModel ? (
            <div className="flex h-full w-full items-center justify-center bg-black/20 text-xs font-semibold uppercase tracking-[0.18em] text-[#777]">
              Loading editor
            </div>
          ) : layoutMode === "fidelity" ? (
            <FidelityCanvas documentId={documentId} model={currentModel} onModelChange={setCurrentModel} />
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
          isAssistantOpen ? "w-[300px]" : "w-10"
        }`}
      >
        {!isAssistantOpen ? (
          <button
            onClick={() => setIsAssistantOpen(true)}
            className="flex h-full w-full items-start justify-center px-2 pt-4 text-[#777] transition-colors hover:bg-white/[0.03] hover:text-white"
            aria-label="Open Gemini assistant"
          >
            <SparklesIcon className="h-4 w-4 text-orange-500/80" />
          </button>
        ) : (
          <>
        <div className="flex h-12 items-center border-b border-white/[0.06] px-3">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
          <span className="ml-2 text-xs font-medium text-white/85">Assistant</span>
          <button
            onClick={() => setIsAssistantOpen(false)}
            className="ml-auto rounded p-1 text-[#777] transition-colors hover:bg-white/[0.04] hover:text-white"
            aria-label="Collapse Gemini assistant"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#666]">Mode</div>
              <div className="inline-flex rounded-md border border-white/10 bg-white/[0.02] p-0.5">
                <button
                  onClick={() => void setLayoutMode("editable")}
                  className={`rounded px-2 py-1 text-[10px] font-medium uppercase ${layoutMode === "editable" ? "bg-white text-black" : "text-[#777] hover:text-white"}`}
                >
                  Editable
                </button>
                <button
                  onClick={() => {
                    if (!canUseFidelity) { toast("Fidelity view is available after PDF import finishes.", "info"); return; }
                    void setLayoutMode("fidelity");
                  }}
                  className={`rounded px-2 py-1 text-[10px] font-medium uppercase transition-colors ${
                    layoutMode === "fidelity"
                      ? "bg-white text-black"
                      : canUseFidelity
                        ? "text-[#777] hover:text-white"
                        : "text-[#555] cursor-not-allowed"
                  }`}
                >
                  Fidelity
                </button>
              </div>
            </div>

            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Rewrite, summarize, format..."
              className="min-h-28 w-full resize-none rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5 text-sm text-[#ededed] outline-none transition-all placeholder:text-[#555] focus:border-orange-500/50 focus:bg-white/[0.04]"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={runAi}
                disabled={!canRunAi}
                className="flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRunningAi ? "Generating..." : "Run"}
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-[#777] transition-colors hover:border-white/20 hover:text-white"
              >
                History
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-[#555]">AI changes open in review before they touch your document.</p>
          </div>
        </div>
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
