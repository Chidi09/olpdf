"use client";

import { ArrowDownTrayIcon, CheckCircleIcon, ExclamationTriangleIcon, PhotoIcon, DocumentTextIcon, TableCellsIcon } from "@heroicons/react/24/outline";
import { CopyButton } from "@/components/ui/CopyButton";

type ImageResult = { data: string; index: number; format: string };
type FormField = { name: string; type: string; current_value?: string; rect?: number[] };

type ResultData = {
  status?: string;
  url?: string;
  urls?: string[];
  message?: string;
  detail?: string;
  original_bytes?: number;
  compressed_bytes?: number;
  savings_pct?: number;
  images?: ImageResult[];
  count?: number;
  parts?: number;
  page_count?: number;
  [key: string]: unknown;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ToolkitResultCard({ result, operation }: { result: ResultData; operation: string }) {
  const hasError = result.status === "error" || result.status === "invalid_json";
  const hasUrl = typeof result.url === "string" && result.url.length > 0;
  const hasUrls = Array.isArray(result.urls) && result.urls.length > 0;
  const isCompress = operation === "compress" && result.original_bytes && result.compressed_bytes;
  const isImages = operation === "extract-images" && Array.isArray(result.images);

  return (
    <div className={`overflow-hidden rounded-lg border transition-all ${
      hasError ? "border-red-500/30 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5"
    }`}>
      <div className={`flex items-center gap-3 border-b px-4 py-3 ${
        hasError ? "border-red-500/20 text-red-400" : "border-emerald-500/20 text-emerald-400"
      }`}>
        {hasError ? (
          <ExclamationTriangleIcon className="h-5 w-5" />
        ) : (
          <CheckCircleIcon className="h-5 w-5" />
        )}
        <span className="text-sm font-semibold">{hasError ? (result.message || result.detail || "Operation failed") : "Operation completed"}</span>
      </div>

      <div className="space-y-3 p-4">
        {/* Compression metrics */}
        {isCompress && (
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Original</span>
              <p className="font-mono text-[var(--text-primary)]">{formatBytes(result.original_bytes!)}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Compressed</span>
              <p className="font-mono text-emerald-400">{formatBytes(result.compressed_bytes!)}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Saved</span>
              <p className="font-mono text-emerald-400">{result.savings_pct}%</p>
            </div>
          </div>
        )}

        {/* Output URL */}
        {hasUrl && (
          <div className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-2">
            <DocumentTextIcon className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            <span className="flex-1 truncate text-xs font-mono text-[var(--text-primary)]">{result.url}</span>
            <CopyButton textToCopy={result.url!} />
            <a href={result.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1 text-[10px] font-semibold text-[var(--text-on-accent)] hover:opacity-90">
              <ArrowDownTrayIcon className="h-3 w-3" /> Download
            </a>
          </div>
        )}

        {/* Split outputs */}
        {hasUrls && (
          <div className="space-y-1">
            {result.urls!.map((u, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-2">
                <DocumentTextIcon className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span className="flex-1 truncate text-xs text-[var(--text-primary)]">Part {i + 1}</span>
                <a href={u} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-md bg-[var(--accent)] px-2 py-1 text-[10px] font-semibold text-[var(--text-on-accent)] hover:opacity-90">
                  <ArrowDownTrayIcon className="h-3 w-3" /> Download
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Extracted images */}
        {isImages && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {(result.images as ImageResult[]).slice(0, 8).map((img, i) => (
              <div key={i} className="group relative overflow-hidden rounded-md border border-[var(--border-subtle)] bg-black">
                <img src={`data:image/${img.format};base64,${img.data}`} alt={`Image ${i + 1}`} className="h-20 w-full object-contain" />
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <a href={`data:image/${img.format};base64,${img.data}`} download={`image_${i + 1}.${img.format}`}
                    className="rounded bg-white/20 px-2 py-1 text-[10px] text-white hover:bg-white/30">
                    Save
                  </a>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80">
                  #{i + 1} {img.format}
                </div>
              </div>
            ))}
            {(result.images as ImageResult[]).length > 8 && (
              <div className="flex items-center justify-center rounded-md border border-dashed border-[var(--border-subtle)] text-[10px] text-[var(--text-tertiary)]">
                +{(result.images as ImageResult[]).length - 8} more
              </div>
            )}
          </div>
        )}

        {/* Merge page count */}
        {operation === "merge" && result.page_count && (
          <p className="text-xs text-[var(--text-secondary)]">Merged {result.page_count} documents into one PDF.</p>
        )}

        {/* Split parts count */}
        {operation === "split" && result.parts && (
          <p className="text-xs text-[var(--text-secondary)]">Split into {result.parts} parts.</p>
        )}

        {/* Form detection */}
        {operation === "detect-forms" && Array.isArray(result) && (result as unknown as FormField[]).length > 0 && (
          <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
                  <th className="px-3 py-2 text-left font-semibold text-[var(--text-tertiary)]">Field</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--text-tertiary)]">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--text-tertiary)]">Value</th>
                </tr>
              </thead>
              <tbody>
                {(result as unknown as FormField[]).map((field, i) => (
                  <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-3 py-2 font-mono text-[var(--text-primary)]">{field.name}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{field.type}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{field.current_value || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Error detail */}
        {hasError && result.detail && (
          <p className="text-xs text-red-300">{result.detail}</p>
        )}
      </div>
    </div>
  );
}
