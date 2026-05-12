"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { InlineSpinner } from "@/components/ui/MicroUI";

type InlineConfirmButtonProps = {
  onConfirm: () => Promise<void> | void;
  idleLabel?: string;
  confirmLabel?: string;
  className?: string;
  disabled?: boolean;
};

export function InlineConfirmButton({
  onConfirm,
  idleLabel = "Delete",
  confirmLabel = "Click to confirm",
  className = "",
  disabled = false,
}: InlineConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);

  const onClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || loading) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      setArmed(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`rounded-md border px-2 py-1 text-xs font-semibold transition-all ${
        armed
          ? "border-red-500/50 bg-red-500/15 text-red-300"
          : "border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-red-500/30 hover:text-red-400"
      } ${className}`}
    >
      {loading ? (
        <span className="inline-flex items-center gap-1"><InlineSpinner className="h-3 w-3 text-red-300" /> Working</span>
      ) : armed ? (
        confirmLabel
      ) : (
        idleLabel
      )}
    </button>
  );
}
