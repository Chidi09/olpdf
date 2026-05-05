import React from "react";

export function DiffView({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-xs">
        <div className="mb-1 font-bold uppercase text-red-300">Before</div>
        <p>{before}</p>
      </div>
      <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
        <div className="mb-1 font-bold uppercase text-emerald-300">After</div>
        <p>{after}</p>
      </div>
    </div>
  );
}
