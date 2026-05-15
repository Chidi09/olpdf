"use client";

import type { ReactNode } from "react";
import {
  Bars3BottomLeftIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { InlineSpinner } from "@/components/ui/MicroUI";
import { GlassTooltip } from "@/components/ui/GlassTooltip";

type EditorCommandBarProps = {
  mode: "editable" | "fidelity";
  title: string;
  isSaving: boolean;
  canUseFidelity: boolean;
  showModeToggle?: boolean;
  nativeSessionStatus?: string;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onModeToggle: () => void;
  onExport: () => void;
  isExporting: boolean;
  aiSlot?: ReactNode;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
};

export default function EditorCommandBar({
  mode,
  title,
  isSaving,
  onModeToggle,
  onTitleChange,
  onTitleBlur,
  onExport,
  isExporting,
  showModeToggle,
  aiSlot,
  leftSlot,
  rightSlot,
}: EditorCommandBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-black/40 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="rounded-md p-1.5 text-[#888] transition-colors hover:bg-white/[0.05] hover:text-white" aria-label="Back to dashboard">
          <ChevronLeftIcon className="h-4 w-4" />
        </Link>
        {leftSlot}
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-64 rounded border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-white outline-none transition-all hover:border-[#333] focus:border-orange-500 focus:bg-[#0A0A0A]"
        />
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#666]">
          {isSaving ? (
            <><InlineSpinner className="h-3 w-3 text-[#888]" /> Syncing...</>
          ) : (
            <><CheckCircleIcon className="h-3 w-3 text-[#666]" /> Saved</>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showModeToggle !== false && (
        <GlassTooltip label={mode === "editable" ? "Switch to Fidelity" : "Switch to Editable"}>
          <button
            onClick={onModeToggle}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[#333] bg-[#0A0A0A] px-2.5 text-xs font-semibold text-[#888] transition-colors hover:bg-[#111] hover:text-white active:scale-[0.98]"
          >
            {mode === "editable" ? "Fidelity" : "Editable"}
          </button>
        </GlassTooltip>
        )}
        {aiSlot}
        <GlassTooltip label="Export PDF">
          <button onClick={onExport} disabled={isExporting} className="flex h-8 items-center gap-1.5 rounded-md border border-[#333] bg-[#0A0A0A] px-3 text-xs font-semibold text-[#ededed] transition-colors hover:bg-[#111] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
            {isExporting ? <InlineSpinner className="h-3.5 w-3.5" /> : <ArrowDownTrayIcon className="h-3.5 w-3.5" />} {isExporting ? "Exporting" : "Export"}
          </button>
        </GlassTooltip>
        {rightSlot}
      </div>
    </header>
  );
}
