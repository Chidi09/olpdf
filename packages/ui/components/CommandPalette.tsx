import React from "react";

export function CommandPalette({ open, commands, onSelect }: { open: boolean; commands: string[]; onSelect: (command: string) => void }) {
  if (!open) return null;
  return (
    <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-2 shadow-2xl">
      {commands.map((command) => (
        <button key={command} onClick={() => onSelect(command)} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-white/10">
          {command}
        </button>
      ))}
    </div>
  );
}
