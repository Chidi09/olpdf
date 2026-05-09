"use client";

const SHORTCUTS = [
  { keys: ["Cmd", "Z"], action: "Undo" },
  { keys: ["Cmd", "Shift", "Z"], action: "Redo" },
  { keys: ["Cmd", "S"], action: "Save" },
  { keys: ["Cmd", "F"], action: "Find" },
  { keys: ["Cmd", "H"], action: "Find & Replace" },
  { keys: ["Cmd", "B"], action: "Bold" },
  { keys: ["Cmd", "I"], action: "Italic" },
  { keys: ["Delete"], action: "Delete selected block" },
  { keys: ["Escape"], action: "Deselect / Close" },
  { keys: ["?"], action: "Show shortcuts" },
];

export function ShortcutMap({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-[520px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-sm font-bold">Keyboard Shortcuts</div>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex items-center justify-between text-xs">
              <span>{s.action}</span>
              <span className="font-mono text-[var(--text-secondary)]">{s.keys.join(" + ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
