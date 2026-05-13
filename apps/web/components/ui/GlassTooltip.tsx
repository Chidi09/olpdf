"use client";

import React from "react";

export function GlassTooltip({
  children,
  label,
  shortcut,
  placement = "top",
}: {
  children: React.ReactNode;
  label: string;
  shortcut?: string;
  placement?: "top" | "bottom";
}) {
  const posClass =
    placement === "bottom"
      ? "top-full mt-2 bottom-auto mb-0"
      : "bottom-full mb-2 top-auto mt-0";

  return (
    <div className="relative group inline-block">
      {children}
      <div className={`pointer-events-none absolute ${posClass} left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-[#050505] border border-[var(--border-subtle)] shadow-xl rounded-md text-[10px] font-medium text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-150 whitespace-nowrap z-50 flex items-center gap-2`}>
        {label}
        {shortcut && (
          <span className="text-[var(--text-tertiary)] font-mono tracking-widest">{shortcut}</span>
        )}
      </div>
    </div>
  );
}
