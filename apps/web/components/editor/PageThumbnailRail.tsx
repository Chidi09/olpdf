"use client";

import { DocumentIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface PageInfo {
  page_index: number;
  width: number;
  height: number;
}

interface PageThumbnailRailProps {
  pageDimensions: PageInfo[];
  activePageIndex?: number;
  onSelectPage: (pageIndex: number) => void;
  onReorderPages?: (fromIndex: number, toIndex: number) => void;
}

export default function PageThumbnailRail({ pageDimensions, activePageIndex, onSelectPage, onReorderPages }: PageThumbnailRailProps) {
  if (pageDimensions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#555] text-xs gap-2">
        <DocumentIcon className="h-8 w-8 opacity-30" />
        <p>No pages yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pageDimensions.map((dim, idx) => {
        const ratio = dim.height > 0 ? dim.width / dim.height : 0.707;
        const thumbWidth = 160;
        const thumbHeight = Math.round(thumbWidth / ratio);
        const isActive = idx === activePageIndex;
        const canMoveUp = idx > 0;
        const canMoveDown = idx < pageDimensions.length - 1;

        return (
          <div
            key={idx}
            className={`group relative flex w-full items-center gap-3 rounded-md border p-2 transition-all ${
              isActive
                ? "border-orange-500/40 bg-orange-500/10"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
            }`}
          >
            <button onClick={() => onSelectPage(idx)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <div
                className="shrink-0 overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.03] flex items-center justify-center"
                style={{ width: thumbWidth, height: Math.min(thumbHeight, 120) }}
              >
                <DocumentIcon className="h-6 w-6 text-[#555] opacity-40" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#aaa]">Page {idx + 1}</p>
                <p className="text-[10px] text-[#555]">
                  {Math.round(dim.width)} x {Math.round(dim.height)}
                </p>
              </div>
            </button>

            {onReorderPages && (
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onReorderPages(idx, idx - 1); }}
                  disabled={!canMoveUp}
                  className="rounded p-0.5 text-[#555] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ChevronUpIcon className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onReorderPages(idx, idx + 1); }}
                  disabled={!canMoveDown}
                  className="rounded p-0.5 text-[#555] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
