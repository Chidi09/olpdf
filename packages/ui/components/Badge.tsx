import React from "react";
import { cn } from "../utils";

type BadgeStatus = "draft" | "review" | "final" | "processing";

const statusStyles: Record<BadgeStatus, string> = {
  draft: "bg-white/10 text-[var(--text-secondary)]",
  review: "bg-amber-500/10 text-amber-300",
  final: "bg-emerald-500/10 text-emerald-300",
  processing: "bg-blue-500/10 text-blue-300",
};

export function Badge({ status, className }: { status: BadgeStatus; className?: string }) {
  return <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", statusStyles[status], className)}>{status}</span>;
}
