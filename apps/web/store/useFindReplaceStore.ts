import { create } from "zustand";

export interface Match {
  blockId: string;
  pageIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

interface FindReplaceState {
  open: boolean;
  query: string;
  replacement: string;
  mode: "find" | "replace";
  matchCase: boolean;
  useRegex: boolean;
  matches: Match[];
  currentMatchIndex: number;
  setOpen: (open: boolean) => void;
  setQuery: (q: string) => void;
  setReplacement: (r: string) => void;
  setMode: (m: "find" | "replace") => void;
  setMatchCase: (v: boolean) => void;
  setUseRegex: (v: boolean) => void;
  setMatches: (m: Match[]) => void;
  setCurrentMatchIndex: (i: number) => void;
  nextMatch: () => void;
  prevMatch: () => void;
}

export const useFindReplaceStore = create<FindReplaceState>((set, get) => ({
  open: false,
  query: "",
  replacement: "",
  mode: "find",
  matchCase: false,
  useRegex: false,
  matches: [],
  currentMatchIndex: 0,
  setOpen: (open) => set({ open }),
  setQuery: (query) => set({ query }),
  setReplacement: (replacement) => set({ replacement }),
  setMode: (mode) => set({ mode }),
  setMatchCase: (matchCase) => set({ matchCase }),
  setUseRegex: (useRegex) => set({ useRegex }),
  setMatches: (matches) => set({ matches, currentMatchIndex: 0 }),
  setCurrentMatchIndex: (currentMatchIndex) => set({ currentMatchIndex }),
  nextMatch: () => {
    const { currentMatchIndex, matches } = get();
    if (!matches.length) return;
    set({ currentMatchIndex: (currentMatchIndex + 1) % matches.length });
  },
  prevMatch: () => {
    const { currentMatchIndex, matches } = get();
    if (!matches.length) return;
    set({ currentMatchIndex: (currentMatchIndex - 1 + matches.length) % matches.length });
  },
}));
