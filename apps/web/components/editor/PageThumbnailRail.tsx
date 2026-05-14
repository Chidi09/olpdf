"use client";

import { DocumentIcon } from "@heroicons/react/24/outline";

interface PageInfo {
  page_index: number;
  width: number;
  height: number;
}

interface PageThumbnailRailProps {
  pageDimensions: PageInfo[];
  activePageIndex?: number;
  onSelectPage: (pageIndex: number) => void;
}

export default function PageThumbnailRail({ pageDimensions, activePageIndex, onSelectPage }: PageThumbnailRailProps) {
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

        return (
          <button
            key={idx}
            onClick={() => onSelectPage(idx)}
            className={`group relative flex w-full items-center gap-3 rounded-md border p-2 text-left transition-all ${
              isActive
                ? "border-orange-500/40 bg-orange-500/10"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
            }`}
          >
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
        );
      })}
    </div>
  );
}
