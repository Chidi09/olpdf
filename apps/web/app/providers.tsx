
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const [queryClient] = useState(
    () =>
      new QueryClient({
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
      })
  );

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("olpdf_onboarding_seen");
    if (!hasSeenOnboarding) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowOnboarding(true);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem("olpdf_onboarding_seen", "true");
    setShowOnboarding(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      {showOnboarding && <OnboardingWalkthrough onComplete={completeOnboarding} />}
      
      {children}
    </QueryClientProvider>
  );
}
