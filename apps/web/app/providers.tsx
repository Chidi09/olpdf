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
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      reportError(err, { source: "service-worker-registration" });
    });

    // When a new SW takes control (new Vercel deployment activated),
    // reload the page so users get the latest version immediately.
    const reload = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", reload);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", reload);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        {children}
      </TenantProvider>
    </QueryClientProvider>
  );
}
