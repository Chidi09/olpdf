"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Command = { id: string; label: string; run: () => void };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const commands = useMemo<Command[]>(
    () => [
      { id: "new-doc", label: "Create Document", run: () => router.push("/editor/new") },
      { id: "new-book", label: "Create Book", run: () => router.push("/books/new") },
      { id: "api-settings", label: "API Settings", run: () => router.push("/settings/developer") },
      { id: "docs", label: "Open Docs", run: () => router.push("/docs") },
      { id: "help", label: "Open Help", run: () => router.push("/help") },
    ],
    [router],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((v) => Math.min(v + 1, Math.max(filtered.length - 1, 0)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((v) => Math.max(v - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[active];
        if (item) {
          item.run();
          setOpen(false);
          setQuery("");
          setActive(0);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="mx-auto mt-24 w-full max-w-xl rounded-xl border border-white/15 bg-[var(--bg-glass)] p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command..."
          className="h-10 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] outline-none"
        />
        <div className="mt-2 max-h-72 overflow-auto">
          {filtered.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                item.run();
                setOpen(false);
                setQuery("");
              }}
              className={`flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors ${idx === active ? "bg-[var(--accent-subtle)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"}`}
            >
              {item.label}
            </button>
          ))}
          {!filtered.length && <div className="px-3 py-3 text-sm text-[var(--text-tertiary)]">No commands found.</div>}
        </div>
      </div>
    </div>
  );
}
