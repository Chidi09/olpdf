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
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { PageShell } from "@/components/layout/PageShell";
import { useToolkitStore } from "@/store/useToolkitStore";
import { useToastStore } from "@/store/useToastStore";
import { InlineSpinner, HelperText } from "@/components/ui/MicroUI";
import { ToolkitResultCard } from "@/components/toolkit/ToolkitResultCard";
import { usePdfWasm } from "@/hooks/usePdfWasm";

type MicroStatus = {
  state: "idle" | "working" | "success" | "error";
  label: string;
  detail?: string;
};

type OperationForm = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  needsDoc: boolean;
  bodyless: boolean;
  showForm: boolean;
  helpText: string;
};

const operations: OperationForm[] = [
  { id: "merge", title: "Merge PDFs", description: "Combine multiple files.", icon: DocumentDuplicateIcon, needsDoc: false, bodyless: false, showForm: true, helpText: "Select two or more documents to merge into a single PDF." },
  { id: "split", title: "Split PDF", description: "Extract specific pages.", icon: ScissorsIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Enter page ranges like 1-3, 5, 8-10 to extract." },
  { id: "compress", title: "Compress", description: "Reduce file size.", icon: ArrowsPointingInIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Optimize PDF size by removing redundant data. No configuration needed." },
  { id: "rotate", title: "Rotate", description: "Rotate pages 90/180 deg.", icon: ArrowPathIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Choose rotation angle and select which pages to rotate." },
  { id: "watermark", title: "Watermark", description: "Apply visible marks.", icon: SparklesIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Add a diagonal text watermark to every page." },
  { id: "protect", title: "Protect", description: "Apply encryption.", icon: LockClosedIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Password-protect with AES-256 encryption." },
  { id: "redact", title: "Redact", description: "Remove sensitive vectors.", icon: NoSymbolIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Define rectangular areas on pages to redact. Coordinates are in PDF points (72 pts = 1 inch)." },
  { id: "extract-images", title: "Extract Images", description: "Export embedded media.", icon: PhotoIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Extract all embedded images from the PDF." },
  { id: "detect-forms", title: "Detect Forms", description: "Identify fillable fields.", icon: DocumentMagnifyingGlassIcon, needsDoc: true, bodyless: true, showForm: false, helpText: "Scan the PDF for fillable form fields." },
  { id: "fill-forms", title: "Fill Forms", description: "Programmatically fill.", icon: PencilSquareIcon, needsDoc: true, bodyless: false, showForm: true, helpText: "Fill form fields with values. Use 'Detect Forms' first to see available fields." },
];

export default function ToolkitPage() {
  const { activeOperationId, inputValue, running, result, setActiveOperationId, setInputValue, setRunning, setResult } = useToolkitStore();
  const toast = useToastStore((s) => s.toast);
  const { preflightPdf, ready: wasmReady } = usePdfWasm();
  const [documents, setDocuments] = useState<Array<{ id: string; title?: string }>>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [mergeDocIds, setMergeDocIds] = useState<string[]>([]);
  const [splitRanges, setSplitRanges] = useState("");
  const [rotation, setRotation] = useState<number>(90);
  const [pageIndices, setPageIndices] = useState("");
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.15);
  const [userPassword, setUserPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [redactAreas, setRedactAreas] = useState("");
  const [fillFormPayload, setFillFormPayload] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<MicroStatus>({ state: "idle", label: "No upload running" });
  const [operationStatus, setOperationStatus] = useState<MicroStatus>({ state: "idle", label: "Ready" });
  const [preflightInfo, setPreflightInfo] = useState<{ page_count: number; dimensions: string } | null>(null);
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

  const buildPayload = useMemo(() => {
    return () => {
      const docId = selectedDocumentId;
      switch (active.id) {
        case "merge":
          return { doc_ids: mergeDocIds.length > 0 ? mergeDocIds : [docId] };
        case "split":
          return { doc_id: docId, page_ranges: splitRanges.split(",").map((s) => {
            const trimmed = s.trim();
            const parts = trimmed.split("-");
            return parts.length === 2 ? { start: parseInt(parts[0]), end: parseInt(parts[1]) } : { start: parseInt(trimmed), end: parseInt(trimmed) };
          }) };
        case "rotate":
          return { doc_id: docId, rotation, page_indices: pageIndices ? pageIndices.split(",").map((s) => parseInt(s.trim())) : undefined };
        case "watermark":
          return { doc_id: docId, text: watermarkText, opacity: watermarkOpacity };
        case "protect":
          return { doc_id: docId, user_password: userPassword, owner_password: ownerPassword };
        case "redact": {
          let areas: Array<{ page_number: number; bbox: number[] }> = [];
          try { areas = JSON.parse(redactAreas); } catch { areas = [{ page_number: 0, bbox: [72, 72, 180, 96] }]; }
          return { doc_id: docId, areas };
        }
        case "fill-forms": {
          let fields: Record<string, string> = {};
          try { fields = JSON.parse(fillFormPayload); } catch { fields = {}; }
          return { doc_id: docId, payload: fields };
        }
        default:
          return { doc_id: docId };
      }
    };
  }, [active.id, selectedDocumentId, mergeDocIds, splitRanges, rotation, pageIndices, watermarkText, watermarkOpacity, userPassword, ownerPassword, redactAreas, fillFormPayload]);

  const runOperation = async () => {
    setRunning(true);
    setOperationStatus({ state: "working", label: "Processing", detail: active.title });
    let payload: Record<string, unknown>;
    try {
      payload = inputValue.trim() && showAdvanced ? JSON.parse(inputValue) : buildPayload();
    } catch {
      toast("Invalid configuration. Check form values.", "error");
      setRunning(false);
      return;
    }

    setOperationStatus({ state: "working", label: "Running", detail: `${active.title} is executing.` });
    setResult(null);

    try {
      const response = await fetch(`/api/bff/toolkit/${active.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.message || data?.detail || "Toolkit operation failed";
        setResult({ status: "error", message, detail: data?.detail || "", ...data });
        setOperationStatus({ state: "error", label: "Failed", detail: message });
        toast(message, "error");
        return;
      }
      setResult(data);
      const summary = data?.url ? "Result file ready" : data?.urls ? `${data.urls.length} files ready` : data?.count ? `${data.count} images extracted` : "Completed";
      setOperationStatus({ state: "success", label: "Success", detail: summary });
      toast(summary, "success");
    } catch {
      setResult({ status: "error", message: "Network error" });
      setOperationStatus({ state: "error", label: "Network error" });
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
      setUploadStatus({ state: "error", label: "Upload failed" });
      return;
    }

    setUploadStatus({ state: "working", label: "Reading PDF" });
    const arrayBuffer = await file.arrayBuffer();

    if (wasmReady) {
      try {
        const preflight = await preflightPdf(arrayBuffer);
        const firstDims = preflight.page_dimensions?.[0];
        const dimStr = firstDims ? `${Math.round(firstDims.width)}×${Math.round(firstDims.height)} pt` : "";
        setPreflightInfo({ page_count: preflight.page_count, dimensions: dimStr });
      } catch { }
    }

    setUploadStatus({ state: "working", label: "Uploading PDF" });
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("failed_to_read_file"));
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        resolve(dataUrl.split(",")[1] || "");
      };
      reader.readAsDataURL(file);
    });

    const importRes = await fetch("/api/bff/import/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: created.id, fileBytes: base64, layout_mode: "fidelity" }),
    }).catch(() => null);
    if (!importRes?.ok) {
      setUploadStatus({ state: "error", label: "Upload failed", detail: "The PDF could not be stored for toolkit operations." });
      toast("Upload failed. Try another PDF or refresh and try again.", "error");
      return;
    }

    setDocuments((prev) => [{ id: created.id, title: file.name }, ...prev]);
    setSelectedDocumentId(created.id);
    setUploadStatus({ state: "success", label: "Upload finished", detail: `${file.name} ready.` });
    toast("PDF uploaded and ready for toolkit operations.", "success");
  };

  const StatusPill = ({ status }: { status: MicroStatus }) => {
    const activeState = status.state === "working";
    const tone = status.state === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
      : status.state === "error" ? "border-red-500/25 bg-red-500/10 text-red-300"
      : status.state === "working" ? "border-orange-500/25 bg-orange-500/10 text-orange-300"
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
            {preflightInfo && (
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                <span className="font-semibold">{preflightInfo.page_count} page{preflightInfo.page_count !== 1 ? "s" : ""}</span>
                {preflightInfo.dimensions && <span className="text-emerald-400/70">{preflightInfo.dimensions}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Sidebar */}
          <div className="grid h-min grid-cols-1 gap-2 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
            {operations.map((op) => {
              const isActive = active.id === op.id;
              return (
                <button key={op.id} onClick={() => { setActiveOperationId(op.id); setResult(null); setOperationStatus({ state: "idle", label: "Ready" }); }}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    isActive ? "border-[var(--accent)] bg-[var(--bg-elevated)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]"
                  }`}>
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

          {/* Main panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] px-5 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border-strong)] bg-[var(--bg-elevated)]">
                  <active.icon className="h-4 w-4 text-[var(--accent)]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{active.title}</h3>
                  {active.helpText && <p className="text-[10px] text-[var(--text-tertiary)]">{active.helpText}</p>}
                </div>
              </div>

              <div className="space-y-5 p-5">
                {/* Document selector */}
                {active.needsDoc || active.id === "merge" ? (
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {active.id === "merge" ? "Documents to Merge" : "Target Document"}
                    </label>
                    {active.id === "merge" ? (
                      <div className="space-y-2">
                        <select
                          onChange={(e) => { if (e.target.value && !mergeDocIds.includes(e.target.value)) setMergeDocIds((prev) => [...prev, e.target.value]); }}
                          className="h-9 w-full appearance-none rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]"
                        >
                          <option value="">Add document to merge...</option>
                          {documents.map((doc) => (
                            <option key={doc.id} value={doc.id}>{doc.title || doc.id}</option>
                          ))}
                        </select>
                        {mergeDocIds.length > 0 && (
                          <div className="space-y-1">
                            {mergeDocIds.map((id) => {
                              const doc = documents.find((d) => d.id === id);
                              return (
                                <div key={id} className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-2">
                                  <span className="text-xs text-[var(--text-primary)]">{doc?.title || id}</span>
                                  <button onClick={() => setMergeDocIds((prev) => prev.filter((x) => x !== id))} className="text-[10px] text-red-400 hover:underline">Remove</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <HelperText>Add at least 2 documents to merge.</HelperText>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <select value={selectedDocumentId} onChange={(e) => setSelectedDocumentId(e.target.value)}
                          className="h-9 flex-1 appearance-none rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]">
                          <option value="">Select a document...</option>
                          {documents.map((doc) => (
                            <option key={doc.id} value={doc.id}>{doc.title || doc.id}</option>
                          ))}
                        </select>
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploadStatus.state === "working"}
                          className="flex h-9 items-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-panel)] disabled:cursor-not-allowed disabled:opacity-60">
                          {uploadStatus.state === "working" ? <InlineSpinner className="h-3 w-3" /> : null}
                          {uploadStatus.state === "working" ? "Uploading" : "Upload PDF"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Per-operation form fields */}
                {active.id === "split" && (
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Page Ranges</label>
                    <input type="text" value={splitRanges} onChange={(e) => setSplitRanges(e.target.value)} placeholder="e.g. 0-1, 3, 5-7" className="h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] placeholder:text-[var(--text-tertiary)]" />
                    <HelperText>Comma-separated page ranges. Pages are 0-indexed.</HelperText>
                  </div>
                )}

                {active.id === "rotate" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Rotation</label>
                      <select value={rotation} onChange={(e) => setRotation(parseInt(e.target.value))}
                        className="h-9 w-full appearance-none rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]">
                        <option value={90}>90° clockwise</option>
                        <option value={180}>180°</option>
                        <option value={270}>270° clockwise (90° CCW)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Pages (optional)</label>
                      <input type="text" value={pageIndices} onChange={(e) => setPageIndices(e.target.value)} placeholder="All pages if empty" className="h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] placeholder:text-[var(--text-tertiary)]" />
                      <HelperText>Comma-separated 0-indexed page numbers.</HelperText>
                    </div>
                  </div>
                )}

                {active.id === "watermark" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Text</label>
                      <input type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} placeholder="CONFIDENTIAL" className="h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]" />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Opacity ({Math.round(watermarkOpacity * 100)}%)</label>
                      <input type="range" min="0" max="100" value={Math.round(watermarkOpacity * 100)} onChange={(e) => setWatermarkOpacity(parseInt(e.target.value) / 100)} className="h-9 w-full accent-[var(--accent)]" />
                    </div>
                  </div>
                )}

                {active.id === "protect" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">User Password</label>
                      <input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Required to open" className="h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]" />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Owner Password</label>
                      <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Required to modify permissions" className="h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]" />
                    </div>
                  </div>
                )}

                {active.id === "redact" && (
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Redaction Areas (JSON)</label>
                    <textarea value={redactAreas} onChange={(e) => setRedactAreas(e.target.value)} rows={4} placeholder='[{"page_number": 0, "bbox": [72, 72, 180, 96]}]' className="w-full resize-y rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3 font-mono text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]" />
                    <HelperText>Array of areas with page_number and bbox [x1, y1, x2, y2] in PDF points. Full visual redaction UI coming in a future release.</HelperText>
                  </div>
                )}

                {active.id === "fill-forms" && (
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Form Values (JSON)</label>
                    <textarea value={fillFormPayload} onChange={(e) => setFillFormPayload(e.target.value)} rows={4} placeholder='{"full_name": "John Doe", "date": "2026-05-13"}' className="w-full resize-y rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3 font-mono text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]" />
                    <HelperText>Key-value pairs mapping form field names to values. Use Detect Forms first to discover field names.</HelperText>
                  </div>
                )}

                {/* Bodyless operations just need a document */}
                {active.bodyless && active.needsDoc && (
                  <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3">
                    <p className="text-xs text-[var(--text-secondary)]">This operation needs no additional configuration. Select a document and click Execute.</p>
                  </div>
                )}

                {/* Advanced JSON toggle */}
                <div>
                  <button onClick={() => setShowAdvanced((v) => !v)} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                    <ChevronDownIcon className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-0" : "-rotate-90"}`} />
                    Advanced JSON
                  </button>
                  {showAdvanced && (
                    <div className="mt-2">
                      <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} rows={6} placeholder="Enter raw JSON payload..."
                        className="w-full resize-y rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3 font-mono text-xs text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]" spellCheck={false} />
                      <HelperText>Override form values with a custom JSON payload. The form values are used unless JSON is provided here.</HelperText>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] px-5 py-3">
                <span className="text-xs text-[var(--text-tertiary)]">Tool executes against the backend immediately.</span>
                <button onClick={runOperation} disabled={running || (!selectedDocumentId && active.needsDoc)}
                  className="flex h-8 items-center gap-2 rounded-md bg-white px-4 text-xs font-semibold text-black transition-all hover:bg-[#e5e5e5] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70">
                  {running && <InlineSpinner className="w-3 h-3 text-black" />}
                  {running ? "Processing..." : `Execute ${active.title}`}
                </button>
              </div>
            </div>

            {/* Result display */}
            {result && (
              <ToolkitResultCard result={result} operation={active.id} />
            )}
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => void importPdf(e.target.files?.[0] || null)} />
      </div>
    </PageShell>
  );
}
