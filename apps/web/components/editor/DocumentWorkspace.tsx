"use client";

import { useMemo, useEffect } from "react";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import dynamic from "next/dynamic";
import ExportButton from "@/components/ExportButton";
import AiEditDiffPanel from "@/components/editor/AiEditDiffPanel";
import AiHistoryPanel from "@/components/editor/AiHistoryPanel";
import { useDocumentQuery, useSaveDocumentMutation } from "@/hooks/useDocumentQueries";
import { useInstalledPlugins } from "@/hooks/usePlugins";
import { PluginHost } from "./PluginHost";
import { useEditorStore } from "@/store/useEditorStore";

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

  const setLayoutMode = async (mode: "editable" | "fidelity") => {
    if (!currentModel || currentModel.meta.layout_mode === mode) return;
    const nextModel: DocumentModel = {
      ...currentModel,
      meta: { ...currentModel.meta, layout_mode: mode },
    };
    setCurrentModel(nextModel);
    await saveMutation.mutateAsync(nextModel);
  };

  return (
    <div className="h-screen w-full relative">
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

      <div className="fixed top-16 right-6 z-40 w-[340px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] p-4 backdrop-blur-md shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold tracking-widest uppercase text-[var(--text-tertiary)]">AI</div>
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
          placeholder="Rewrite this section to be more concise..."
          className="w-full min-h-20 rounded bg-black/20 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={runAi}
            disabled={!canRunAi}
            className="flex-1 rounded bg-[var(--accent)] text-[var(--text-on-accent)] text-sm font-bold px-3 py-2 disabled:opacity-40"
          >
            {isRunningAi ? "Generating..." : "Generate"}
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="rounded border border-white/15 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            History
          </button>
        </div>
        {currentModel && <ExportButton model={currentModel} documentId={documentId} />}
      </div>

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
