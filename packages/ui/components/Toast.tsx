import React from "react";

type Kind = "success" | "warning" | "error" | "info";

const tones: Record<Kind, string> = {
  success: "bg-emerald-500/10 text-emerald-200 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-200 border-amber-500/30",
  error: "bg-red-500/10 text-red-200 border-red-500/30",
  info: "bg-blue-500/10 text-blue-200 border-blue-500/30",
};

export function Toast({ kind, message }: { kind: Kind; message: string }) {
  return <div className={`rounded border px-3 py-2 text-xs ${tones[kind]}`}>{message}</div>;
}
