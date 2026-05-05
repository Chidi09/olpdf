import React from "react";

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded bg-black px-2 py-1 text-[10px] text-white group-hover:block">
        {label}
      </span>
    </span>
  );
}
