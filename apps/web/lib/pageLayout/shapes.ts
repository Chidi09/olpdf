import type { ShapeFrame, SymbolFrame } from "@/types/pageLayout";

export type ShapeKind = "rect" | "roundedRect" | "ellipse" | "line" | "arrow";

export function createShapeFrame(kind: ShapeKind, x: number, y: number, w = 100, h = 80): ShapeFrame {
  const id = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const base = {
    id,
    type: "shape" as const,
    visible: true,
    locked: false,
    zIndex: 0,
    opacity: 1,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    stroke: "#111111",
    strokeWidth: 2,
    fill: "transparent",
  };

  if (kind === "ellipse") {
    return { ...base, shapeType: "ellipse" as const };
  }
  if (kind === "line") {
    return { ...base, shapeType: "line" as const, height: 2 };
  }
  if (kind === "arrow") {
    return { ...base, shapeType: "arrow" as const, height: 2 };
  }
  if (kind === "roundedRect") {
    return { ...base, shapeType: "rounded_rect" as const };
  }
  return { ...base, shapeType: "rect" as const };
}

const COMMON_SYMBOLS = ["✓", "✗", "★", "●", "§", "©", "®", "™", "•", "→", "←", "↑", "↓", "↔", "†", "‡"];

export function createSymbolFrame(symbol: string, x: number, y: number): SymbolFrame {
  return {
    id: `sym-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "symbol",
    symbolId: symbol,
    size: 24,
    color: "#111111",
    visible: true,
    locked: false,
    zIndex: 0,
    opacity: 1,
    x,
    y,
    width: 40,
    height: 40,
    rotation: 0,
  };
}

export { COMMON_SYMBOLS };
