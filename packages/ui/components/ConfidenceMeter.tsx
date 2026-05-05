import React from "react";

export function ConfidenceMeter({ score }: { score: number }) {
  const width = Math.max(0, Math.min(1, score)) * 100;
  return (
    <div className="space-y-1">
      <div className="h-2 w-full rounded bg-white/10">
        <div className="h-2 rounded bg-[var(--status-review)]" style={{ width: `${width}%` }} />
      </div>
      <div className="text-[10px] text-[var(--text-tertiary)]">{score.toFixed(2)}</div>
    </div>
  );
}
