import { create } from "zustand";
import type { PdfEditOperation, PdfEditSession } from "@/types/nativePdf";
import { applyOperationToSession } from "@/lib/nativePdf/applyOperations";

type NativePdfSessionState = {
  session: PdfEditSession | null;
  isSyncing: boolean;
  lastError: string | null;
  setSession: (session: PdfEditSession | null) => void;
  appendOperation: (operation: PdfEditOperation) => void;
  setSyncing: (isSyncing: boolean) => void;
  setLastError: (lastError: string | null) => void;
};

export const useNativePdfSessionStore = create<NativePdfSessionState>()((set) => ({
  session: null,
  isSyncing: false,
  lastError: null,
  setSession: (session) => set({ session }),
  appendOperation: (operation) =>
    set((state) => ({
      session: state.session ? applyOperationToSession(state.session, operation) : state.session,
    })),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setLastError: (lastError) => set({ lastError }),
}));
