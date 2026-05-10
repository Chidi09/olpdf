"use client";

export interface ErrorContext {
  source?: string;       // "window", "react-boundary", "query", "mutation"
  userId?: string;
  extra?: Record<string, unknown>;
}

/**
 * Central error reporting sink.
 * Reports to PostHog in all environments; also logs to console in development.
 * Safe to call even before PostHog has loaded — it will no-op.
 */
export function reportError(error: unknown, context: ErrorContext = {}) {
  const err = error instanceof Error ? error : new Error(String(error));

  if (process.env.NODE_ENV === "development") {
    console.error(`[${context.source ?? "app"}]`, err, context.extra ?? "");
  }

  try {
    // posthog-js attaches to window.posthog after init.
    // We read it dynamically so this file has no hard import dependency.
    const ph = (typeof window !== "undefined" ? (window as unknown as Record<string, unknown>).posthog : undefined) as
      | { capture: (event: string, props: Record<string, unknown>) => void }
      | undefined;

    ph?.capture("$exception", {
      $exception_message: err.message,
      $exception_type: err.name,
      $exception_stack_trace_raw: err.stack,
      source: context.source ?? "unknown",
      userId: context.userId,
      ...context.extra,
    });
  } catch {
    // Reporting must never throw.
  }
}
