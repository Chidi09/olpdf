import React from "react";

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">{title}</h3>
          <button onClick={onClose} className="text-xs text-[var(--text-secondary)]">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
