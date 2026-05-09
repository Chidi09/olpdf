"use client";

import type { ComponentType } from "react";
import { Combine, Scissors, Minimize2, RotateCw, Droplets, Lock, Eraser, ScanText, Images, FileText, Edit3 } from "lucide-react";
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
  { id: "ocr", title: "OCR Scan", description: "Convert scanned pages to searchable text.", icon: ScanText },
  { id: "extract-images", title: "Extract Images", description: "Export all embedded images.", icon: Images },
  { id: "detect-forms", title: "Detect Forms", description: "Identify fillable fields in PDF.", icon: FileText },
  { id: "fill-forms", title: "Fill Forms", description: "Programmatically fill PDF forms.", icon: Edit3 },
];

export default function ToolkitPage() {
  const { activeOperationId, inputValue, running, result, setActiveOperationId, setInputValue, setRunning, setResult } = useToolkitStore();

  const active = operations.find((o) => o.id === activeOperationId) ?? operations[0];

  const runOperation = async () => {
    setRunning(true);
    try {
      const response = await fetch(`/api/bff/toolkit/${active.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inputValue }),
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
