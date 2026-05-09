import { create } from "zustand";

export type ShapeTool =
  | "select"
  | "rect"
  | "roundedRect"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "sticky"
  | "draw";

export interface SelectedBlockMeta {
  blockId: string;
  blockType: string;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  color: string;
  alignment: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface FidelityCanvasState {
  activeTool: ShapeTool;
  selectedBlock: SelectedBlockMeta | null;
  setActiveTool: (tool: ShapeTool) => void;
  setSelectedBlock: (block: SelectedBlockMeta | null) => void;
}

export const useFidelityCanvasStore = create<FidelityCanvasState>()((set) => ({
  activeTool: "select",
  selectedBlock: null,
  setActiveTool: (activeTool) => set({ activeTool }),
  setSelectedBlock: (selectedBlock) => set({ selectedBlock }),
}));
