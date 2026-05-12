"use client";

import { useEffect, useState } from "react";
import { PencilIcon } from "@heroicons/react/24/outline";
import { InlineSpinner } from "@/components/ui/MicroUI";

type InlineEditableTextProps = {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  className?: string;
};

export function InlineEditableText({ value, onSave, className = "" }: InlineEditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = async () => {
    const next = draft.trim();
    if (!next || next === value) {
      setEditing(false);
      setDraft(value);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(value);
            }
          }}
          onBlur={() => void save()}
          className="h-7 rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)] outline-none"
        />
        {saving && <InlineSpinner className="h-3 w-3 text-[var(--accent)]" />}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditing(true);
      }}
      className={`group inline-flex items-center gap-1 text-left ${className}`}
    >
      <span className="truncate">{value}</span>
      <PencilIcon className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
