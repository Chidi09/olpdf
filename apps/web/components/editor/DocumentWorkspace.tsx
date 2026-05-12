"use client";

import { useMemo, useEffect, useState } from "react";
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
import {
  Bars3BottomLeftIcon,
  Squares2X2Icon,
  SparklesIcon,
  ChevronLeftIcon,
  PlayIcon,
  ShareIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { InlineSpinner } from "@/components/ui/MicroUI";

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
      if (data.updated_model) setCurrentModel(data.updated_model);
      setInstruction("");
    } finally {
      setIsRunningAi(false);
    }
  };

  const acceptAi = async () => {
    if (!activeAiLog) return;
    await fetch(`/api/bff/ai/logs/${activeAiLog.id}/accept`, { method: "POST" });
    setActiveAiLog(null);
  };

  const rejectAi = async () => {
    if (!activeAiLog) return;
    await fetch(`/api/bff/ai/logs/${activeAiLog.id}/reject`, { method: "POST" });
    setActiveAiLog(null);
  };

  const aiDiff = useMemo(() => {
    if (!activeAiLog?.diff_snapshot) return null;
    return activeAiLog.diff_snapshot;
  }, [activeAiLog]);

  const layoutMode = currentModel?.meta?.layout_mode ?? "editable";
  const [leftTab, setLeftTab] = useState<"outline" | "blocks">("outline");

  const setLayoutMode = async (mode: "editable" | "fidelity") => {
    if (!currentModel || currentModel.meta.layout_mode === mode) return;
    const nextModel: DocumentModel = {
      ...currentModel,
      meta: { ...currentModel.meta, layout_mode: mode },
    };
    setCurrentModel(nextModel);
    await saveMutation.mutateAsync(nextModel);
  };

  const outlineItems = useMemo(() => {
    const blocks = currentModel?.blocks || [];
    return blocks.slice(0, 24).map((b, index) => {
      const text = String((b as { content?: { text?: string } }).content?.text || "").trim();
      const label = text || `Block ${index + 1}`;
      const type = String((b as { type?: string }).type || "p").toUpperCase().slice(0, 2);
      return { id: b.id, label, type };
    });
  }, [currentModel?.blocks]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-black text-[#ededed]">
      <aside className="z-20 flex w-[260px] shrink-0 flex-col border-r border-white/[0.08] bg-black/40 backdrop-blur-2xl">
        <div className="flex h-14 items-center border-b border-white/[0.08] px-3">
          <Link href="/dashboard" className="mr-2 rounded-md p-1.5 text-[#888] transition-colors hover:bg-white/[0.05] hover:text-white">
            <ChevronLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-gradient-to-br from-orange-500 to-orange-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)]">
              <span className="text-[10px] font-black text-white">O</span>
            </div>
            <span className="text-xs font-semibold tracking-wide">Editor</span>
          </div>
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
          <div className="space-y-0.5">
            {outlineItems.map((item) => (
              <div key={item.id} className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#cfcfcf] transition-colors hover:bg-[#111]">
                <span className="flex h-3 w-3 items-center justify-center rounded-sm border border-[#444] bg-[#111] text-[8px] text-[#888] group-hover:border-orange-500 group-hover:text-orange-500">
                  {leftTab === "outline" ? item.type : "B"}
                </span>
                <span className="truncate">{item.label}</span>
              </div>
            ))}
            {outlineItems.length === 0 && <p className="px-2 py-2 text-xs text-[#666]">No blocks yet.</p>}
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />

        <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-black/40 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <input
              type="text"
              defaultValue={currentModel?.meta?.title || "untitled_document.pdf"}
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
            <button className="flex h-8 w-8 items-center justify-center rounded-md border border-[#333] bg-[#0A0A0A] text-[#888] transition-colors hover:bg-[#111] active:scale-[0.98]">
              <ShareIcon className="h-4 w-4" />
            </button>
            <button className="flex h-8 items-center gap-1.5 rounded-md border border-[#333] bg-[#0A0A0A] px-3 text-xs font-semibold text-[#ededed] transition-colors hover:bg-[#111] active:scale-[0.98]">
              <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Export
            </button>
            <button className="ml-2 flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-semibold text-black shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all hover:bg-[#e5e5e5] active:scale-[0.98]">
              <PlayIcon className="h-3.5 w-3.5" /> Publish
            </button>
          </div>
        </header>

        <div className="relative z-20 flex-1 overflow-hidden">
          {layoutMode === "fidelity" && currentModel ? (
            <FidelityCanvas documentId={documentId} model={currentModel} onModelChange={setCurrentModel} />
          ) : (
            <CollaborativeEditor
              documentId={documentId}
              userName="Divine Adoyi"
              userColor="#e6a449"
              initialModel={currentModel ?? undefined}
              onModelChange={setCurrentModel}
            />
          )}
        </div>
      </main>

      <aside className="z-20 flex w-[320px] shrink-0 flex-col border-l border-white/[0.08] bg-black/40 backdrop-blur-2xl">
        <div className="flex h-14 items-center border-b border-white/[0.08] px-4">
          <SparklesIcon className="mr-2 h-4 w-4 text-orange-500" />
          <span className="text-xs font-semibold tracking-wide text-white">Gemini Assistant</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3 rounded-md border border-white/10 bg-white/[0.02] p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">AI Session</div>
              <div className="inline-flex rounded-full border border-white/15 p-0.5">
                <button
                  onClick={() => void setLayoutMode("editable")}
                  className={`px-2 py-1 text-[10px] font-semibold uppercase ${layoutMode === "editable" ? "bg-[var(--accent)] text-[var(--text-on-accent)]" : "text-[var(--text-secondary)]"}`}
                >
                  Editable
                </button>
                <button
                  onClick={() => void setLayoutMode("fidelity")}
                  className={`px-2 py-1 text-[10px] font-semibold uppercase ${layoutMode === "fidelity" ? "bg-[var(--accent)] text-[var(--text-on-accent)]" : "text-[var(--text-secondary)]"}`}
                >
                  Fidelity
                </button>
              </div>
            </div>

            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Ask Gemini to rewrite, summarize, or format..."
              className="min-h-24 w-full rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-[#ededed] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-subtle)]"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={runAi}
                disabled={!canRunAi}
                className="flex-1 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--text-on-accent)] disabled:opacity-40"
              >
                {isRunningAi ? "Generating..." : "Run"}
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                History
              </button>
            </div>

            {currentModel && <ExportButton model={currentModel} documentId={documentId} />}
          </div>
        </div>
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
