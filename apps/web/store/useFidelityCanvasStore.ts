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

export interface FormatCommand {
  fontFamily?: string;
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
  color?: string;
  alignment?: "left" | "center" | "right" | "justify";
  left?: number;
  top?: number;
  width?: number;
}

interface FidelityCanvasState {
  activeTool: ShapeTool;
  selectedBlock: SelectedBlockMeta | null;
  pendingFormat: FormatCommand | null;
  setActiveTool: (tool: ShapeTool) => void;
  setSelectedBlock: (block: SelectedBlockMeta | null) => void;
  applyFormat: (cmd: FormatCommand) => void;
  clearPendingFormat: () => void;
}

export const useFidelityCanvasStore = create<FidelityCanvasState>()((set) => ({
  activeTool: "select",
  selectedBlock: null,
  pendingFormat: null,
  setActiveTool: (activeTool) => set({ activeTool }),
  setSelectedBlock: (selectedBlock) => set({ selectedBlock }),
  applyFormat: (cmd) => set({ pendingFormat: cmd }),
  clearPendingFormat: () => set({ pendingFormat: null }),
}));
