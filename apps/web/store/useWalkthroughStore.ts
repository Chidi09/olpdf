import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WalkthroughState {
  seen: boolean;
  currentStep: number;
  markSeen: () => void;
  setCurrentStep: (step: number) => void;
  reset: () => void;
}

export const useWalkthroughStore = create<WalkthroughState>()(
  persist(
    (set) => ({
      seen: false,
      currentStep: 0,
      markSeen: () => set({ seen: true, currentStep: 0 }),
      setCurrentStep: (currentStep) => set({ currentStep }),
      reset: () => set({ seen: false, currentStep: 0 }),
    }),
    { name: "olpdf-walkthrough" }
  )
);
