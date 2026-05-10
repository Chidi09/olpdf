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
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Capture whether a SW is already in control BEFORE registration.
    // If false this is a first-ever visit — we must NOT reload when the
    // initial SW takes control or we'd create an infinite reload loop.
    const hadController = !!navigator.serviceWorker.controller;

    let intervalId: ReturnType<typeof setInterval>;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Poll for new deployments every 30 s.
        // The browser only auto-checks on navigation, so this makes
        // updates near-instant without requiring a page refresh.
        intervalId = setInterval(() => reg.update(), 30_000);

        // updatefound fires when a new SW starts installing.
        reg.addEventListener("updatefound", () => {
          const incoming = reg.installing;
          if (!incoming) return;

          incoming.addEventListener("statechange", () => {
            // 'installed' + existing controller = update ready, not first install.
            if (incoming.state === "installed" && navigator.serviceWorker.controller) {
              // next-pwa sets skipWaiting:true so the new SW activates
              // immediately; controllerchange will fire and reload.
              // Belt-and-suspenders: also send SKIP_WAITING in case config changed.
              incoming.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch((err) => reportError(err, { source: "service-worker-registration" }));

    // controllerchange fires when the new SW claims the page.
    // Only reload if there was already a controller (= a real update, not first install).
    const onControllerChange = () => {
      if (hadController) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        {children}
      </TenantProvider>
    </QueryClientProvider>
  );
}
