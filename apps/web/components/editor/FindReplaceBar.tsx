"use client";

import { useEffect, useRef } from "react";
import type { DocumentModel } from "@olpdf/document-model";
import { useFindReplaceStore } from "@/store/useFindReplaceStore";
import { findMatches, replaceAll, replaceMatch } from "@/engine/search";

interface FindReplaceBarProps {
  model: DocumentModel;
  onModelChange: (model: DocumentModel) => void;
}

export function FindReplaceBar({ model, onModelChange }: FindReplaceBarProps) {
  const store = useFindReplaceStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        store.setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        store.setOpen(true);
        store.setMode("replace");
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") {
        store.setOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);

  useEffect(() => {
    if (!store.open || !store.query) {
      store.setMatches([]);
      return;
    }
    const matches = findMatches(model, store.query, {
      matchCase: store.matchCase,
      useRegex: store.useRegex,
    });
    store.setMatches(matches);
    // Intentionally exclude `store` itself — including the whole store object causes
    // an infinite loop because setMatches triggers a re-render with a new store ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, store.open, store.query, store.matchCase, store.useRegex]);

  if (!store.open) return null;

  return (
    <div className="sticky top-[60px] z-50 mx-auto mb-2 w-full max-w-[1200px]">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 shadow-lg">
        <input
          ref={inputRef}
          type="text"
          placeholder="Find..."
          value={store.query}
          onChange={(e) => store.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (e.shiftKey) store.prevMatch();
            else store.nextMatch();
          }}
          className="h-7 flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 text-xs focus:outline-none"
        />

        <span className="w-20 shrink-0 text-center text-[10px] text-[var(--text-tertiary)]">
          {store.matches.length > 0 ? `${store.currentMatchIndex + 1} / ${store.matches.length}` : store.query ? "No results" : ""}
        </span>

        <button onClick={store.prevMatch} className="rounded px-2 py-1 text-xs hover:bg-[var(--bg-glass-subtle)]">↑</button>
        <button onClick={store.nextMatch} className="rounded px-2 py-1 text-xs hover:bg-[var(--bg-glass-subtle)]">↓</button>

        <button
          onClick={() => store.setMatchCase(!store.matchCase)}
          className={`rounded px-2 py-1 text-[10px] font-bold ${store.matchCase ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--bg-glass-subtle)]"}`}
          title="Match case"
        >
          Aa
        </button>
        <button
          onClick={() => store.setUseRegex(!store.useRegex)}
          className={`rounded px-2 py-1 font-mono text-[10px] ${store.useRegex ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--bg-glass-subtle)]"}`}
          title="Use regex"
        >
          .*
        </button>

        <button
          onClick={() => store.setMode(store.mode === "replace" ? "find" : "replace")}
          className="rounded px-2 py-1 text-[10px] hover:bg-[var(--bg-glass-subtle)]"
        >
          {store.mode === "replace" ? "Hide Replace" : "Replace"}
        </button>

        {store.mode === "replace" && (
          <>
            <input
              type="text"
              placeholder="Replace with..."
              value={store.replacement}
              onChange={(e) => store.setReplacement(e.target.value)}
              className="h-7 flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 text-xs"
            />
            <button
              onClick={() => {
                const match = store.matches[store.currentMatchIndex];
                if (!match) return;
                onModelChange(replaceMatch(model, match, store.replacement));
                // Advance to next match (matches list will be recomputed via
                // the useEffect above; pre-move so the new list lands on the
                // right item after the replaced match disappears).
                store.nextMatch();
              }}
              className="rounded bg-[var(--accent)] px-2 py-1 text-xs text-white hover:opacity-90"
            >
              Replace
            </button>
            <button
              onClick={() => {
                onModelChange(replaceAll(model, store.matches, store.replacement));
              }}
              className="rounded bg-[var(--accent)] px-2 py-1 text-xs text-white hover:opacity-90"
            >
              All
            </button>
          </>
        )}

        <button onClick={() => store.setOpen(false)} className="rounded px-2 py-1 text-xs hover:bg-[var(--bg-glass-subtle)]">x</button>
      </div>
    </div>
  );
}
