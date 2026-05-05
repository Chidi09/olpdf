import React from "react";

export interface PreflightItem {
  type: string;
  detail: string;
  severity: "error" | "warning" | "info";
}

export function PreflightPanel({ items, onClose, onContinue }: { items: PreflightItem[]; onClose: () => void; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Export Preflight</h3>
          <button onClick={onClose} className="text-xs text-[var(--text-secondary)]">Close</button>
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={`${item.type}-${idx}`} className="rounded border border-[var(--border-subtle)] p-2 text-xs">
              <div className="font-semibold uppercase">{item.severity}</div>
              <div>{item.detail}</div>
            </div>
          ))}
        </div>
        <button onClick={onContinue} className="mt-4 rounded bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--text-on-accent)]">Continue</button>
      </div>
    </div>
  );
}
