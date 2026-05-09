import { create } from "zustand";
import { persist } from "zustand/middleware";

type Mode = "guest" | "cloud" | null;
type UseCase = "documents" | "books" | "toolkit" | "forms" | null;

interface OnboardingState {
  step: number;
  mode: Mode;
  useCase: UseCase;
  completed: boolean;
  setStep: (step: number) => void;
  setMode: (mode: Mode) => void;
  setUseCase: (useCase: UseCase) => void;
  complete: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      step: 1,
      mode: null,
      useCase: null,
      completed: false,
      setStep: (step) => set({ step }),
      setMode: (mode) => set({ mode }),
      setUseCase: (useCase) => set({ useCase }),
      complete: () => set({ completed: true }),
      reset: () => set({ step: 1, mode: null, useCase: null, completed: false }),
    }),
    { name: "olpdf-onboarding" }
  )
);
