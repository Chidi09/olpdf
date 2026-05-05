"use client";

import { useMemo, useState } from "react";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import CollaborativeEditor from "@/components/CollaborativeEditor";
import ExportButton from "@/components/ExportButton";
import AiEditDiffPanel from "@/components/editor/AiEditDiffPanel";
import AiHistoryPanel from "@/components/editor/AiHistoryPanel";

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
  const [instruction, setInstruction] = useState("");
  const [currentModel, setCurrentModel] = useState<DocumentModel | null>(null);
  const [isRunningAi, setIsRunningAi] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeAiLog, setActiveAiLog] = useState<AiLog | null>(null);

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

  return (
    <div className="h-screen w-full relative">
      <CollaborativeEditor
        documentId={documentId}
        userName="Divine Adoyi"
        userColor="#e6a449"
        initialModel={currentModel ?? undefined}
        onModelChange={setCurrentModel}
      />

      <div className="fixed top-16 right-6 z-40 w-[340px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] p-4 backdrop-blur-md shadow-2xl space-y-3">
        <div className="text-xs font-bold tracking-widest uppercase text-[var(--text-tertiary)]">AI</div>
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
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
