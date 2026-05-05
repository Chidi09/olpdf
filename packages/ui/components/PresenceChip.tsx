import React from "react";

export function PresenceChip({ name, color }: { name: string; color: string }) {
  return (
    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: color, color: "#101014" }} title={name}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
