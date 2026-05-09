import { create } from "zustand";

interface NavState {
  scrolled: boolean;
  mobileMenuOpen: boolean;
  setScrolled: (scrolled: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
}

export const useNavStore = create<NavState>()((set) => ({
  scrolled: false,
  mobileMenuOpen: false,
  setScrolled: (scrolled) => set({ scrolled }),
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
}));
