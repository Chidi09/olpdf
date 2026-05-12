"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DocumentDuplicateIcon,
  ScissorsIcon,
  ArrowsPointingInIcon,
  ArrowPathIcon,
  SparklesIcon,
  LockClosedIcon,
  NoSymbolIcon,
  PhotoIcon,
  DocumentMagnifyingGlassIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { PageShell } from "@/components/layout/PageShell";
import { useToolkitStore } from "@/store/useToolkitStore";
import { InlineSpinner } from "@/components/ui/MicroUI";

type MicroStatus = {
  state: "idle" | "working" | "success" | "error";
  label: string;
  detail?: string;
};

type ToolkitOperation = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const operations: ToolkitOperation[] = [
  { id: "merge", title: "Merge PDFs", description: "Combine multiple files.", icon: DocumentDuplicateIcon },
  { id: "split", title: "Split PDF", description: "Extract specific pages.", icon: ScissorsIcon },
  { id: "compress", title: "Compress", description: "Reduce file size.", icon: ArrowsPointingInIcon },
  { id: "rotate", title: "Rotate", description: "Rotate pages 90/180 deg.", icon: ArrowPathIcon },
  { id: "watermark", title: "Watermark", description: "Apply visible marks.", icon: SparklesIcon },
  { id: "protect", title: "Protect", description: "Apply encryption.", icon: LockClosedIcon },
  { id: "redact", title: "Redact", description: "Remove sensitive vectors.", icon: NoSymbolIcon },
  { id: "extract-images", title: "Extract Images", description: "Export embedded media.", icon: PhotoIcon },
  { id: "detect-forms", title: "Detect Forms", description: "Identify fillable fields.", icon: DocumentMagnifyingGlassIcon },
  { id: "fill-forms", title: "Fill Forms", description: "Programmatically fill.", icon: PencilSquareIcon },
];

export default function ToolkitPage() {
  const { activeOperationId, inputValue, running, result, setActiveOperationId, setInputValue, setRunning, setResult } = useToolkitStore();
  const [documents, setDocuments] = useState<Array<{ id: string; title?: string }>>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [uploadStatus, setUploadStatus] = useState<MicroStatus>({ state: "idle", label: "No upload running" });
  const [operationStatus, setOperationStatus] = useState<MicroStatus>({ state: "idle", label: "Ready" });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setOperationStatus({ state: "working", label: "Validating payload", detail: active.title });
    try {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = inputValue.trim() ? JSON.parse(inputValue) : JSON.parse(suggestedInput);
      } catch {
        setResult({ status: "invalid_json" });
        setOperationStatus({ state: "error", label: "Invalid JSON", detail: "Fix the operation payload and retry." });
        return;
      }

      if (!parsed.doc_id && active.id !== "merge") {
        parsed.doc_id = selectedDocumentId;
      }

      setOperationStatus({ state: "working", label: "Running toolkit job", detail: `${active.title} is executing on the backend.` });

      const response = await fetch(`/api/bff/toolkit/${active.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof data?.message === "string" ? data.message : typeof data?.detail === "string" ? data.detail : "Toolkit operation failed";
        setResult({ status: "error", message, ...data });
        setOperationStatus({ state: "error", label: "Tool failed", detail: message });
        return;
      }
      setResult(data);
      setOperationStatus({ state: "success", label: "Tool finished", detail: data?.url ? "Result file is ready." : "Operation completed." });
    } finally {
      setRunning(false);
    }
  };

  const importPdf = async (file: File | null) => {
    if (!file) return;
    setUploadStatus({ state: "working", label: "Creating document", detail: file.name });
    const createRes = await fetch("/api/bff/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: file.name.replace(/\.pdf$/i, "") || "Imported PDF" }),
    });
    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !created?.id) {
      setUploadStatus({ state: "error", label: "Upload failed", detail: "Could not create a document record." });
      return;
    }

    setUploadStatus({ state: "working", label: "Reading PDF", detail: file.name });
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("failed_to_read_file"));
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        resolve(dataUrl.split(",")[1] || "");
      };
      reader.readAsDataURL(file);
    });

    setUploadStatus({ state: "working", label: "Uploading PDF", detail: "Sending file bytes to storage." });
    const importRes = await fetch("/api/bff/import/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: created.id, fileBytes: base64, layout_mode: "fidelity" }),
    }).catch(() => null);

    if (!importRes?.ok) {
      setUploadStatus({ state: "error", label: "Upload failed", detail: "The PDF could not be stored for toolkit use." });
      return;
    }

    setDocuments((prev) => [{ id: created.id, title: file.name }, ...prev]);
    setSelectedDocumentId(created.id);
    setUploadStatus({ state: "success", label: "Upload finished", detail: `${file.name} is ready for toolkit operations.` });
  };

  const StatusPill = ({ status }: { status: MicroStatus }) => {
    const activeState = status.state === "working";
    const tone =
      status.state === "success"
        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
        : status.state === "error"
          ? "border-red-500/25 bg-red-500/10 text-red-300"
          : status.state === "working"
            ? "border-orange-500/25 bg-orange-500/10 text-orange-300"
            : "border-white/10 bg-white/[0.03] text-[var(--text-tertiary)]";

    return (
      <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${tone}`}>
        {activeState ? <InlineSpinner className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
        <span className="font-semibold">{status.label}</span>
        {status.detail && <span className="hidden max-w-[260px] truncate text-[var(--text-tertiary)] sm:inline">{status.detail}</span>}
      </div>
    );
  };

  return (
    <PageShell>
      <div className="max-w-5xl space-y-8">
        <div className="border-b border-[var(--border-subtle)] pb-5">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">PDF Toolkit</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Professional low-level PDF manipulation utilities.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill status={uploadStatus} />
            <StatusPill status={operationStatus} />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="grid h-min grid-cols-1 gap-2 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
            {operations.map((op) => {
              const isActive = active.id === op.id;
              return (
                <button
                  key={op.id}
                  onClick={() => setActiveOperationId(op.id)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    isActive
                      ? "border-[var(--accent)] bg-[var(--bg-elevated)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 ${isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>
                    <op.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">{op.title}</h3>
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{op.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-2">
            <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] px-5 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border-strong)] bg-[var(--bg-elevated)]">
                  <active.icon className="h-4 w-4 text-[var(--accent)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{active.title} Configuration</h3>
              </div>

              <div className="space-y-6 p-5">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Target Document</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedDocumentId}
                      onChange={(e) => setSelectedDocumentId(e.target.value)}
                      className="h-9 flex-1 appearance-none rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]"
                    >
                      <option value="">Select an existing document...</option>
                      {documents.map((doc) => (
                        <option key={doc.id} value={doc.id}>{doc.title || doc.id}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadStatus.state === "working"}
                      className="flex h-9 items-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-panel)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadStatus.state === "working" && <InlineSpinner className="h-3 w-3" />}
                      {uploadStatus.state === "working" ? "Uploading" : "Upload PDF"}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Operation Payload (JSON)</label>
                    <button
                      onClick={() => setInputValue(suggestedInput)}
                      className="text-[10px] font-medium text-[var(--accent)] hover:opacity-80"
                    >
                      Load Template
                    </button>
                  </div>
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="h-48 w-full resize-y rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3 font-mono text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-subtle)]"
                    placeholder="Enter JSON payload..."
                    spellCheck={false}
                  />
                </div>

                {result && (
                  <div className={`break-all rounded-md border p-3 font-mono text-sm ${result.status === "invalid_json" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
                    {JSON.stringify(result, null, 2)}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] px-5 py-3">
                <span className="text-xs text-[var(--text-tertiary)]">Tool executes against the backend immediately.</span>
                <button
                  onClick={runOperation}
                  disabled={running}
                  className="flex h-8 items-center gap-2 rounded-md bg-white px-4 text-xs font-semibold text-black transition-all hover:bg-[#e5e5e5] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {running && <InlineSpinner className="w-3 h-3 text-black" />}
                  {running ? "Processing..." : `Execute ${active.title}`}
                </button>
              </div>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => void importPdf(e.target.files?.[0] || null)}
        />
      </div>
    </PageShell>
  );
}
