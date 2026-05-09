import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TemplatesState {
  activeCategory: string;
  searchQuery: string;
  applyingId: string | null;
  setActiveCategory: (activeCategory: string) => void;
  setSearchQuery: (searchQuery: string) => void;
  setApplyingId: (applyingId: string | null) => void;
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set) => ({
      activeCategory: "All",
      searchQuery: "",
      applyingId: null,
      setActiveCategory: (activeCategory) => set({ activeCategory }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setApplyingId: (applyingId) => set({ applyingId }),
    }),
    {
      name: "olpdf-templates",
      partialize: (s) => ({ activeCategory: s.activeCategory, searchQuery: s.searchQuery }),
    }
  )
);
