import { create } from "zustand";
import type { PdfEditOperation } from "@/types/nativePdf";

interface PdfEditOperationsState {
  operations: PdfEditOperation[];
  undone: PdfEditOperation[];
  applyOperation: (op: PdfEditOperation) => void;
  undo: () => PdfEditOperation | null;
  redo: () => PdfEditOperation | null;
  clear: () => void;
}

export const usePdfEditOperationsStore = create<PdfEditOperationsState>((set, get) => ({
  operations: [],
  undone: [],

  applyOperation: (op) => {
    set((state) => ({
      operations: [...state.operations, op],
      undone: [],
    }));
  },

  undo: () => {
    const { operations, undone } = get();
    if (operations.length === 0) return null;
    const op = operations[operations.length - 1];
    set({
      operations: operations.slice(0, -1),
      undone: [...undone, op],
    });
    return op;
  },

  redo: () => {
    const { operations, undone } = get();
    if (undone.length === 0) return null;
    const op = undone[undone.length - 1];
    set({
      operations: [...operations, op],
      undone: undone.slice(0, -1),
    });
    return op;
  },

  clear: () => {
    set({ operations: [], undone: [] });
  },
}));
