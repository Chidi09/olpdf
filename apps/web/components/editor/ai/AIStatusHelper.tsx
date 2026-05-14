"use client";

import type { AiApplyPhase } from "./aiApplyState";

interface AIStatusHelperProps {
  phase: AiApplyPhase;
  onApply?: () => void;
  onViewDiff?: () => void;
  onUndo?: () => void;
  onDismiss?: () => void;
}

const phaseLabels: Record<AiApplyPhase, string> = {
  idle: "",
  streaming: "AI is generating…",
  staging: "Review suggestion",
  applying: "Applying edit…",
  applied: "Edit applied",
  reverted: "Edit reverted",
};

const phaseAccents: Record<AiApplyPhase, string> = {
  idle: "",
  streaming: "border-[#444]",
  staging: "border-orange-500/40",
  applying: "border-orange-500/60",
  applied: "border-emerald-500/40",
  reverted: "border-[#444]",
};

export default function AIStatusHelper({
  phase,
  onApply,
  onViewDiff,
  onUndo,
  onDismiss,
}: AIStatusHelperProps) {
  if (phase === "idle") return null;

  const isActive = phase === "applying" || phase === "streaming";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-[#0A0A0A]/90 px-3 py-2 text-xs backdrop-blur-sm transition-all ${phaseAccents[phase]}`}
    >
      <div className="flex items-center gap-2 text-[#aaa]">
        {isActive && (
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
        )}
        <span className="font-medium text-[#ccc]">{phaseLabels[phase]}</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {phase === "staging" && onApply && (
          <button
            onClick={onApply}
            className="rounded bg-orange-500/20 px-2 py-1 text-[11px] font-semibold text-orange-300 transition-colors hover:bg-orange-500/30"
          >
            Apply
          </button>
        )}
        {phase === "staging" && onViewDiff && (
          <button
            onClick={onViewDiff}
            className="rounded px-2 py-1 text-[11px] text-[#888] transition-colors hover:text-white"
          >
            Diff
          </button>
        )}
        {(phase === "applied" || phase === "reverted") && onUndo && (
          <button
            onClick={onUndo}
            className="rounded px-2 py-1 text-[11px] text-[#888] transition-colors hover:text-white"
          >
            Undo
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="rounded px-1.5 py-1 text-[10px] text-[#555] transition-colors hover:text-white"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
