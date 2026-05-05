import React from "react";

export function Drawer({ open, side = "right", onClose, children }: { open: boolean; side?: "left" | "right"; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <aside
        className={`absolute top-0 h-full w-80 bg-[var(--bg-surface)] border-[var(--border-subtle)] ${side === "right" ? "right-0 border-l" : "left-0 border-r"}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </aside>
    </div>
  );
}
