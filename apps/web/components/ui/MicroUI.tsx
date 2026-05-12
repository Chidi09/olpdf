import React from "react";

export function InlineSpinner({ className = "w-4 h-4 text-[#888]" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export function SkeletonRow({ index = 0 }: { index?: number }) {
  const delay = `${index * 120}ms`;
  return (
    <div className="flex items-center justify-between border-b border-[#222] bg-[#0A0A0A] px-4 py-3">
      <div className="flex w-full items-center gap-4">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-[#111]" style={{ animationDelay: delay }} />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-48 animate-pulse rounded bg-[#1A1A1A]" style={{ animationDelay: delay }} />
          <div className="h-2 w-32 animate-pulse rounded bg-[#111]" style={{ animationDelay: delay }} />
        </div>
      </div>
      <div className="h-3 w-16 shrink-0 animate-pulse rounded bg-[#111]" style={{ animationDelay: delay }} />
    </div>
  );
}

export function HelperText({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-relaxed text-[#666]">{children}</p>;
}
