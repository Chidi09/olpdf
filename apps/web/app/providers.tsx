"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import { TenantProvider } from "@/components/providers/TenantProvider";
import { reportError } from "@/lib/errorReporting";

// Module-level singleton — QueryClient config never changes at runtime
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        reportError(error, { source: "mutation" });
      },
    },
  },
});

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {

  // Layer 1: catch JS errors and unhandled rejections outside React trees.
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      reportError(e.error ?? e.message, { source: "window", extra: { filename: e.filename, lineno: e.lineno } });
    };
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      reportError(e.reason, { source: "window:unhandledrejection" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register SW for offline caching only — we do NOT rely on SW events
    // for update detection because the timing is unpredictable.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => reportError(err, { source: "service-worker-registration" }));
    }

    // ── Build-hash deploy detection (same technique as VarianTrade) ──────────
    // Next.js embeds the current buildId in window.__NEXT_DATA__.
    // Each Vercel deployment generates a new buildId, which changes the
    // asset filenames under /_next/static/{buildId}/.
    // We poll that path every 30 s — if it 404s the build has rotated.
    const buildId = (window as { __NEXT_DATA__?: { buildId?: string } })
      .__NEXT_DATA__?.buildId;

    if (!buildId) return; // dev / SSR edge case — skip

    let reloading = false;

    const checkForUpdate = async () => {
      if (document.visibilityState !== "visible" || reloading) return;
      try {
        const res = await fetch(
          `/_next/static/${buildId}/_buildManifest.js`,
          { cache: "no-store", method: "HEAD" }
        );
        if (!res.ok && res.status === 404) {
          // New build deployed — assets for this buildId no longer exist.
          reloading = true;
          window.location.reload();
        }
      } catch {
        // Network error — skip silently, try again next interval
      }
    };

    // Check immediately on mount (catches deployments that happened while
    // the tab was open in the background), then every 30 seconds.
    void checkForUpdate();
    const intervalId = setInterval(checkForUpdate, 30_000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        {children}
      </TenantProvider>
    </QueryClientProvider>
  );
}
