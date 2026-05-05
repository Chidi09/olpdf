"use client";

import { Spinner } from "@olpdf/ui";

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-base)]">
      <Spinner size="xl" />
    </div>
  );
}
