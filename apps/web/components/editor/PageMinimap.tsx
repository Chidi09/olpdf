"use client";

import { useMemo } from "react";

type PageMinimapProps = {
  pageCount: number;
  onJump?: (page: number) => void;
};

export default function PageMinimap({ pageCount, onJump }: PageMinimapProps) {
  const pages = useMemo(() => Array.from({ length: Math.max(pageCount, 1) }, (_, i) => i + 1), [pageCount]);

  return (
    <aside className="fixed left-2 top-20 z-20 hidden max-h-[70vh] w-16 overflow-y-auto rounded-lg border border-white/10 bg-[var(--bg-glass)] p-2 backdrop-blur md:block">
      <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Pages</div>
      <div className="space-y-1">
        {pages.map((page) => (
          <button
            key={page}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", String(page))}
            onClick={() => onJump?.(page)}
            className="w-full rounded border border-white/10 px-1 py-2 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {page}
          </button>
        ))}
      </div>
    </aside>
  );
}
