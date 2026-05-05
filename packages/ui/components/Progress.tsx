import React from "react";

export function Progress({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full rounded bg-white/10">
      <div className="h-2 rounded bg-[var(--accent)] transition-all" style={{ width: `${safe}%` }} />
    </div>
  );
}
