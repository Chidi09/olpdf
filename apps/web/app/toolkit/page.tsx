"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { Combine, Scissors, Minimize2, RotateCw, Droplets, Lock, Eraser, Images, FileText, Edit3 } from "lucide-react";
import BackLink from "@/components/BackLink";
import { useToolkitStore } from "@/store/useToolkitStore";

type ToolkitOperation = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const operations: ToolkitOperation[] = [
  { id: "merge", title: "Merge PDFs", description: "Combine multiple files into one.", icon: Combine },
  { id: "split", title: "Split PDF", description: "Extract pages into separate files.", icon: Scissors },
  { id: "compress", title: "Compress", description: "Reduce file size for sharing.", icon: Minimize2 },
  { id: "rotate", title: "Rotate", description: "Rotate pages by 90/180 degrees.", icon: RotateCw },
  { id: "watermark", title: "Watermark", description: "Apply visible watermark to pages.", icon: Droplets },
  { id: "protect", title: "Protect", description: "Apply encryption and permissions.", icon: Lock },
  { id: "redact", title: "Redact (true)", description: "Permanently remove sensitive content.", icon: Eraser },
  { id: "extract-images", title: "Extract Images", description: "Export all embedded images.", icon: Images },
  { id: "detect-forms", title: "Detect Forms", description: "Identify fillable fields in PDF.", icon: FileText },
  { id: "fill-forms", title: "Fill Forms", description: "Programmatically fill PDF forms.", icon: Edit3 },
];

export default function ToolkitPage() {
  const { activeOperationId, inputValue, running, result, setActiveOperationId, setInputValue, setRunning, setResult } = useToolkitStore();
  const [documents, setDocuments] = useState<Array<{ id: string; title?: string }>>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");

  const active = operations.find((o) => o.id === activeOperationId) ?? operations[0];

  useEffect(() => {
    fetch("/api/bff/documents")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Array<{ id: string; title?: string }>) => {
        setDocuments(rows || []);
        if (!selectedDocumentId && rows?.length) setSelectedDocumentId(rows[0].id);
      })
      .catch(() => setDocuments([]));
  }, [selectedDocumentId]);

  const suggestedInput = useMemo(() => {
    const docId = selectedDocumentId || "<document-id>";
    switch (active.id) {
      case "merge":
        return JSON.stringify({ doc_ids: [docId, "<another-document-id>"] }, null, 2);
      case "split":
        return JSON.stringify({ doc_id: docId, page_ranges: [{ start: 0, end: 1 }] }, null, 2);
      case "rotate":
        return JSON.stringify({ doc_id: docId, rotation: 90, page_indices: [0] }, null, 2);
      case "watermark":
        return JSON.stringify({ doc_id: docId, text: "CONFIDENTIAL", opacity: 0.15 }, null, 2);
      case "protect":
        return JSON.stringify({ doc_id: docId, user_password: "user-pass", owner_password: "owner-pass" }, null, 2);
      case "redact":
        return JSON.stringify({ doc_id: docId, areas: [{ page_number: 0, bbox: [72, 72, 180, 96] }] }, null, 2);
      case "detect-forms":
        return JSON.stringify({ doc_id: docId }, null, 2);
      case "fill-forms":
        return JSON.stringify({ doc_id: docId, payload: { full_name: "John Doe" } }, null, 2);
      default:
        return JSON.stringify({ doc_id: docId }, null, 2);
    }
  }, [active.id, selectedDocumentId]);

  const runOperation = async () => {
    setRunning(true);
    try {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = inputValue.trim() ? JSON.parse(inputValue) : JSON.parse(suggestedInput);
      } catch {
        setResult({ status: "invalid_json" });
        return;
      }

      if (!parsed.doc_id && active.id !== "merge") {
        parsed.doc_id = selectedDocumentId;
      }

      const response = await fetch(`/api/bff/toolkit/${active.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!response.ok) throw new Error("Toolkit operation failed");
      setResult(await response.json());
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <BackLink href="/dashboard" label="Back to workspace" className="mb-4" />
            <h1 className="text-3xl font-bold">PDF Toolkit</h1>
            <p className="mt-2 text-[var(--text-secondary)]">Professional PDF utilities with operation-specific controls.</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {operations.map((operation) => (
            <button
              key={operation.id}
              onClick={() => setActiveOperationId(operation.id)}
              className={`rounded-xl border p-5 text-left transition ${
                active.id === operation.id
                  ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
              }`}
            >
              <operation.icon className="h-6 w-6 text-[var(--accent)]" />
              <h2 className="mt-3 text-lg font-semibold">{operation.title}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{operation.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
          <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-tertiary)]">{active.title} Panel</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Provide operation input (file ID, page ranges, notes) and run processing.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Document</label>
              <select
                value={selectedDocumentId}
                onChange={(e) => setSelectedDocumentId(e.target.value)}
                className="mt-2 w-full rounded bg-black/20 border border-white/10 px-3 py-2 text-sm"
              >
                <option value="">Select document</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.title || doc.id}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setInputValue(suggestedInput)}
                className="rounded border border-[var(--border-strong)] px-3 py-2 text-xs font-bold"
              >
                Load Payload Template
              </button>
            </div>
          </div>

          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="mt-4 w-full min-h-24 rounded bg-black/20 border border-white/10 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            placeholder="Input payload for operation..."
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={runOperation}
              disabled={running}
              className="rounded bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[var(--text-on-accent)] disabled:opacity-40"
            >
              {running ? "Running..." : `Run ${active.title}`}
            </button>
            {result?.status && <span className="text-xs text-[var(--text-secondary)]">Status: {result.status}</span>}
          </div>

          {result?.output_url && (
            <div className="mt-4 rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <div>Output: <span className="text-emerald-200">{result.output_url}</span></div>
              {typeof result.pages_processed === "number" && (
                <div className="mt-1 text-[var(--text-secondary)]">Pages processed: {result.pages_processed}</div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
