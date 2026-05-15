import { create } from "zustand";
import type { PageLayoutDocument, PageLayoutPage, LayoutObject, TextFrame, PageDecoration, PageNumberDecoration } from "@/types/pageLayout";

let _nextObjId = 100;
export function nextObjectId(): string {
  return `obj-${++_nextObjId}`;
}

type PageLayoutState = {
  document: PageLayoutDocument | null;
  selectedObjectIds: string[];
  activePageId: string | null;
  dirty: boolean;

  setDocument: (document: PageLayoutDocument | null) => void;
  selectObject: (id: string | null) => void;
  toggleObjectSelection: (id: string) => void;
  clearSelection: () => void;
  insertObject: (pageId: string, object: LayoutObject) => void;
  insertTextFrame: (pageId: string, x: number, y: number, text?: string) => void;
  updateObject: (pageId: string, objectId: string, updates: Partial<LayoutObject>) => void;
  deleteObject: (pageId: string, objectId: string) => void;
  deleteSelectedObjects: () => void;
  setHeader: (header: PageDecoration) => void;
  setFooter: (footer: PageDecoration) => void;
  setPageNumbers: (pageNumbers: PageNumberDecoration) => void;
  removePageDecoration: (kind: "header" | "footer" | "pageNumbers") => void;
  moveObject: (pageId: string, objectId: string, x: number, y: number) => void;
  resizeObject: (pageId: string, objectId: string, width: number, height: number) => void;
  updateTextContent: (pageId: string, objectId: string, content: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  setActivePage: (pageId: string) => void;
  markClean: () => void;
};

export const usePageLayoutStore = create<PageLayoutState>()((set) => ({
  document: null,
  selectedObjectIds: [],
  activePageId: null,
  dirty: false,

  setDocument: (document) =>
    set({
      document,
      selectedObjectIds: [],
      activePageId: document?.pages[0]?.id ?? null,
      dirty: false,
    }),

  selectObject: (id) =>
    set({ selectedObjectIds: id ? [id] : [] }),

  toggleObjectSelection: (id) =>
    set((state) => {
      const has = state.selectedObjectIds.includes(id);
      return {
        selectedObjectIds: has
          ? state.selectedObjectIds.filter((x) => x !== id)
          : [...state.selectedObjectIds, id],
      };
    }),

  clearSelection: () => set({ selectedObjectIds: [] }),

  insertObject: (pageId, object) =>
    set((state) => {
      if (!state.document) return state;
      const pages = state.document.pages.map((p) => {
        if (p.id !== pageId) return p;
        return { ...p, objects: [...p.objects, object] };
      });
      return { document: { ...state.document, pages }, dirty: true };
    }),

  insertTextFrame: (pageId, x, y, text) =>
    set((state) => {
      if (!state.document) return state;
      const page = state.document.pages.find((p) => p.id === pageId);
      if (!page) return state;
      const frame: TextFrame = {
        id: nextObjectId(),
        type: "text",
        content: text ?? "",
        fontFamily: "Inter",
        fontSize: 12,
        fontWeight: "normal",
        fontStyle: "normal",
        underline: false,
        color: "#111111",
        textAlign: "left",
        lineHeight: 1.25,
        letterSpacing: 0,
        bullets: false,
        numbering: false,
        visible: true,
        locked: false,
        zIndex: page.objects.length,
        opacity: 1,
        x,
        y,
        width: 200,
        height: 20,
        rotation: 0,
      };
      const pages = state.document.pages.map((p) => {
        if (p.id !== pageId) return p;
        return { ...p, objects: [...p.objects, frame] };
      });
      return { document: { ...state.document, pages }, dirty: true };
    }),

  updateObject: (pageId, objectId, updates) =>
    set((state) => {
      if (!state.document) return state;
      const pages = state.document.pages.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          objects: p.objects.map((o) =>
            o.id === objectId ? ({ ...o, ...updates } as LayoutObject) : o
          ),
        };
      });
      return { document: { ...state.document, pages }, dirty: true };
    }),

  deleteObject: (pageId, objectId) =>
    set((state) => {
      if (!state.document) return state;
      const pages = state.document.pages.map((p) => {
        if (p.id !== pageId) return p;
        return { ...p, objects: p.objects.filter((o) => o.id !== objectId) };
      });
      return {
        document: { ...state.document, pages },
        selectedObjectIds: state.selectedObjectIds.filter((id) => id !== objectId),
        dirty: true,
      };
    }),

  setHeader: (header: PageDecoration) =>
    set((state) => {
      if (!state.document) return state;
      return {
        document: {
          ...state.document,
          pageDecorations: { ...state.document.pageDecorations, header },
        },
        dirty: true,
      };
    }),

  setFooter: (footer: PageDecoration) =>
    set((state) => {
      if (!state.document) return state;
      return {
        document: {
          ...state.document,
          pageDecorations: { ...state.document.pageDecorations, footer },
        },
        dirty: true,
      };
    }),

  setPageNumbers: (pageNumbers: PageNumberDecoration) =>
    set((state) => {
      if (!state.document) return state;
      return {
        document: {
          ...state.document,
          pageDecorations: { ...state.document.pageDecorations, pageNumbers },
        },
        dirty: true,
      };
    }),

  removePageDecoration: (kind: "header" | "footer" | "pageNumbers") =>
    set((state) => {
      if (!state.document || !state.document.pageDecorations) return state;
      const updated = { ...state.document.pageDecorations };
      delete updated[kind];
      return {
        document: { ...state.document, pageDecorations: updated },
        dirty: true,
      };
    }),

  deleteSelectedObjects: () =>
    set((state) => {
      if (!state.document || state.selectedObjectIds.length === 0) return state;
      const ids = new Set(state.selectedObjectIds);
      const pages = state.document.pages.map((p) => ({
        ...p,
        objects: p.objects.filter((o) => !ids.has(o.id)),
      }));
      return {
        document: { ...state.document, pages },
        selectedObjectIds: [],
        dirty: true,
      };
    }),

  moveObject: (pageId, objectId, x, y) =>
    set((state) => {
      if (!state.document) return state;
      const pages = state.document.pages.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          objects: p.objects.map((o) =>
            o.id === objectId ? ({ ...o, x, y } as LayoutObject) : o
          ),
        };
      });
      return { document: { ...state.document, pages }, dirty: true };
    }),

  resizeObject: (pageId, objectId, width, height) =>
    set((state) => {
      if (!state.document) return state;
      const pages = state.document.pages.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          objects: p.objects.map((o) =>
            o.id === objectId ? ({ ...o, width, height } as LayoutObject) : o
          ),
        };
      });
      return { document: { ...state.document, pages }, dirty: true };
    }),

  updateTextContent: (pageId, objectId, content) =>
    set((state) => {
      if (!state.document) return state;
      const pages = state.document.pages.map((p) => {
        if (p.id !== pageId) return p;
        return {
          ...p,
          objects: p.objects.map((o) =>
            o.id === objectId ? ({ ...o, content } as LayoutObject) : o
          ),
        };
      });
      return { document: { ...state.document, pages }, dirty: true };
    }),

  reorderPages: (fromIndex, toIndex) =>
    set((state) => {
      if (!state.document) return state;
      const pages = [...state.document.pages];
      const [moved] = pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, moved);
      const reindexed = pages.map((p, i) => ({ ...p, index: i }));
      return { document: { ...state.document, pages: reindexed }, dirty: true };
    }),

  setActivePage: (pageId) => set({ activePageId: pageId }),

  markClean: () => set({ dirty: false }),
}));
