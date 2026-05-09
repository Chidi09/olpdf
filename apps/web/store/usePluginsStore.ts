import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PluginsState {
  activeCategory: string;
  searchQuery: string;
  installingId: string | null;
  setActiveCategory: (activeCategory: string) => void;
  setSearchQuery: (searchQuery: string) => void;
  setInstallingId: (installingId: string | null) => void;
}

export const usePluginsStore = create<PluginsState>()(
  persist(
    (set) => ({
      activeCategory: "All",
      searchQuery: "",
      installingId: null,
      setActiveCategory: (activeCategory) => set({ activeCategory }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setInstallingId: (installingId) => set({ installingId }),
    }),
    {
      name: "olpdf-plugins",
      partialize: (s) => ({ activeCategory: s.activeCategory }),
    }
  )
);
