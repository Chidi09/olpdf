"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import { TenantProvider } from "@/components/providers/TenantProvider";
import { useWalkthroughStore } from "@/store/useWalkthroughStore";

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
    },
  },
});

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  const { seen, markSeen } = useWalkthroughStore();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        {!seen && <OnboardingWalkthrough onComplete={markSeen} />}
        {children}
      </TenantProvider>
    </QueryClientProvider>
  );
}
