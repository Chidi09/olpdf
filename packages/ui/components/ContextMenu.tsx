import React from "react";

export function ContextMenu({ items, onSelect }: { items: string[]; onSelect: (item: string) => void }) {
  return (
    <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
      {items.map((item) => (
        <button key={item} onClick={() => onSelect(item)} className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-white/10">
          {item}
        </button>
      ))}
    </div>
  );
}
