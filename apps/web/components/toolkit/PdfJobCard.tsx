"use client";

import { ArrowDownTrayIcon, CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { InlineSpinner } from "@/components/ui/MicroUI";
import type { JobState } from "@/hooks/usePdfJob";

export function PdfJobCard({
  job,
  operation,
  onDismiss,
}: {
  job: JobState;
  operation: string;
  onDismiss: () => void;
}) {
  const isRunning = job.status === "queued" || job.status === "running";
  const isDone = job.status === "succeeded";
  const isFailed = job.status === "failed";

  return (
    <div className={`overflow-hidden rounded-lg border transition-all ${
      isFailed ? "border-red-500/30 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5"
    }`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {isRunning && <InlineSpinner className="h-5 w-5 text-orange-400" />}
          {isDone && <CheckCircleIcon className="h-5 w-5 text-emerald-400" />}
          {isFailed && <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />}
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {operation === "compress" ? "Compress" : operation.charAt(0).toUpperCase() + operation.slice(1)}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">{job.message || job.status}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Dismiss"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {isRunning && (
        <div className="h-1 bg-white/[0.05]">
          <div
            className="h-full bg-orange-400 transition-all duration-500"
            style={{ width: `${Math.max(job.progress, 5)}%` }}
          />
        </div>
      )}

      {job.outputs.length > 0 && (
        <div className="space-y-1 border-t border-white/[0.05] px-4 py-3">
          {job.outputs.map((o, i) => (
            <a
              key={i}
              href={o.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-2 text-xs hover:bg-white/[0.03] transition-colors"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
              <span className="flex-1 truncate text-[var(--text-primary)]">{o.filename}</span>
            </a>
          ))}
        </div>
      )}

      {isFailed && job.error && (
        <p className="border-t border-white/[0.05] px-4 py-2 text-xs text-red-300">{job.error}</p>
      )}
    </div>
  );
}
