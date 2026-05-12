import { create } from "zustand";

interface DirtyState {
  isDirty: boolean;
  isSaving: boolean;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  reset: () => void;
}

export const useDirtyStore = create<DirtyState>()((set) => ({
  isDirty: false,
  isSaving: false,
  setDirty: (isDirty) => set({ isDirty }),
  setSaving: (isSaving) => set({ isSaving }),
  reset: () => set({ isDirty: false, isSaving: false }),
}));
