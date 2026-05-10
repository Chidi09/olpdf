"use client";

import { useEffect } from "react";
import { ErrorState } from "@olpdf/ui";
import { reportError } from "@/lib/errorReporting";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { source: "react-boundary", extra: { digest: error.digest } });
  }, [error]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-base)] p-6">
      <ErrorState 
        title="Application Error" 
        message={error.message || "An unexpected error occurred in the application."} 
        onRetry={reset} 
      />
    </div>
  );
}
