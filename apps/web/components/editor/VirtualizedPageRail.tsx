"use client";

import { useMemo, useState } from "react";

type VirtualizedPageRailProps = {
  pageCount: number;
  pageHeight?: number;
};

export default function VirtualizedPageRail({ pageCount, pageHeight = 84 }: VirtualizedPageRailProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportHeight = 360;
  const overscan = 4;

  const { start, end, totalHeight } = useMemo(() => {
    const total = Math.max(1, pageCount);
    const rawStart = Math.floor(scrollTop / pageHeight) - overscan;
    const rawEnd = Math.ceil((scrollTop + viewportHeight) / pageHeight) + overscan;
    return {
      start: Math.max(0, rawStart),
      end: Math.min(total - 1, rawEnd),
      totalHeight: total * pageHeight,
    };
  }, [pageCount, pageHeight, scrollTop]);

  const items = [];
  for (let i = start; i <= end; i += 1) {
    items.push(i);
  }

  return (
    <aside className="fixed right-2 top-24 z-20 hidden w-20 rounded-lg border border-white/10 bg-[var(--bg-glass)] p-2 backdrop-blur md:block">
      <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Virtual</div>
      <div
        className="relative overflow-y-auto rounded"
        style={{ height: viewportHeight }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          {items.map((idx) => (
            <div
              key={idx}
              className="absolute left-0 right-0 mx-1 rounded border border-white/10 bg-[var(--bg-elevated)] text-center text-xs text-[var(--text-secondary)]"
              style={{ top: idx * pageHeight, height: pageHeight - 8, lineHeight: `${pageHeight - 8}px` }}
            >
              P{idx + 1}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
