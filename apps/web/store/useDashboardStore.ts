import { create } from "zustand";
import { persist } from "zustand/middleware";

type DashboardTab = "recent" | "documents" | "books";

interface DashboardState {
  activeTab: DashboardTab;
  searchQuery: string;
  setActiveTab: (tab: DashboardTab) => void;
  setSearchQuery: (query: string) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      activeTab: "recent",
      searchQuery: "",
      setActiveTab: (activeTab) => set({ activeTab }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
    }),
    { name: "olpdf-dashboard" }
  )
);
