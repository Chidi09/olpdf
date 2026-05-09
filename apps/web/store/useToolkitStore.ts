import { create } from "zustand";
import { persist } from "zustand/middleware";

type ToolkitResult = { output_url?: string; status?: string; pages_processed?: number } | null;

interface ToolkitState {
  activeOperationId: string;
  inputValue: string;
  running: boolean;
  result: ToolkitResult;
  setActiveOperationId: (id: string) => void;
  setInputValue: (value: string) => void;
  setRunning: (running: boolean) => void;
  setResult: (result: ToolkitResult) => void;
}

export const useToolkitStore = create<ToolkitState>()(
  persist(
    (set) => ({
      activeOperationId: "merge",
      inputValue: "",
      running: false,
      result: null,
      setActiveOperationId: (activeOperationId) => set({ activeOperationId, result: null }),
      setInputValue: (inputValue) => set({ inputValue }),
      setRunning: (running) => set({ running }),
      setResult: (result) => set({ result }),
    }),
    {
      name: "olpdf-toolkit",
      partialize: (s) => ({ activeOperationId: s.activeOperationId, inputValue: s.inputValue }),
    }
  )
);
