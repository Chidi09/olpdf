import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BookState {
  activeDocumentId: string | null;
  isSidebarOpen: boolean;
  setActiveDocumentId: (id: string | null) => void;
  setIsSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useBookStore = create<BookState>()(
  persist(
    (set) => ({
      activeDocumentId: null,
      isSidebarOpen: true,
      setActiveDocumentId: (activeDocumentId) => set({ activeDocumentId }),
      setIsSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
      toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
    }),
    { name: "olpdf-book-workspace" }
  )
);
