import type { DocumentBlock } from "@olpdf/document-model";
import type { RectX0Y0X1Y1 } from "@/lib/geometry/rect";
import { documentRectToCanvasRect } from "@/lib/geometry/rect";

export type TextBlockSpec = {
  type: "textbox";
  left: number;
  top: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  fill: string;
  textAlign: "left" | "center" | "right" | "justify";
  text: string;
  lineHeight: number;
};

export type RectBlockSpec = {
  type: "rect";
  left: number;
  top: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
};

export type EllipseBlockSpec = {
  type: "ellipse";
  left: number;
  top: number;
  rx: number;
  ry: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
};

export type LineBlockSpec = {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
};

export type ImageBlockSpec = {
  type: "image";
  left: number;
  top: number;
  width: number;
  height: number;
  src?: string;
};

export type TableBlockSpec = {
  type: "group";
  left: number;
  top: number;
  width: number;
  height: number;
  headers: string[];
  rows: string[][];
};

export type FieldBlockSpec = {
  type: "rect";
  left: number;
  top: number;
  width: number;
  height: number;
  rx: number;
  ry: number;
  strokeDashArray: [number, number];
};

export type FabricObjectSpec =
  | TextBlockSpec
  | RectBlockSpec
  | EllipseBlockSpec
  | LineBlockSpec
  | ImageBlockSpec
  | TableBlockSpec
  | FieldBlockSpec;

export function blockToFabricSpec(
  block: DocumentBlock,
  scale: number,
): FabricObjectSpec | null {
  const bbox = (block.bounding_box ?? [72, 72, 540, 86]) as RectX0Y0X1Y1;
  const [left, top, right, bottom] = documentRectToCanvasRect(bbox, scale);
  const width = Math.max(right - left, 20);
  const height = Math.max(bottom - top, 20);
  const blockType = (block as any).type ?? "paragraph";

  if (blockType === "image") {
    return {
      type: "image",
      left,
      top,
      width,
      height,
      src: block.src,
    };
  }

  if (blockType === "table") {
    const tableData = (block as any).table_data ?? { headers: [], rows: [] };
    return {
      type: "group",
      left,
      top,
      width,
      height,
      headers: tableData.headers ?? [],
      rows: tableData.rows ?? [],
    };
  }

  if (blockType === "field") {
    return {
      type: "rect",
      left,
      top,
      width: Math.max(width, 24),
      height: Math.max(height, 24),
      rx: 4,
      ry: 4,
      strokeDashArray: [4, 2],
    };
  }

  if (blockType === "shape") {
    const fabricData = (block as any).fabric_data ?? {};
    const objType = String(fabricData.type || "rect").toLowerCase();
    const stroke = String(fabricData.stroke || "#111111");
    const fill = String(fabricData.fill || "rgba(0,0,0,0)");
    const strokeWidth = Number(fabricData.strokeWidth || 2);

    if (objType === "ellipse" || objType === "circle") {
      return {
        type: "ellipse",
        left,
        top,
        rx: Math.max(width * 0.5, 8),
        ry: Math.max(height * 0.5, 8),
        stroke,
        fill,
        strokeWidth,
      };
    }

    if (objType === "line" || objType === "arrow") {
      return {
        type: "line",
        x1: left,
        y1: top,
        x2: right,
        y2: bottom,
        stroke,
        strokeWidth,
      };
    }

    return {
      type: "rect",
      left,
      top,
      width,
      height,
      stroke,
      fill,
      strokeWidth,
    };
  }

  // Default: text
  const fm = (block as any).font_meta ?? {};
  return {
    type: "textbox",
    left,
    top,
    width,
    fontSize: Math.max(((fm.size as number) || 11) * scale, 8),
    fontFamily: (fm.family as string) || "Georgia, serif",
    fontWeight: (fm.is_bold as boolean) ? "bold" : "normal",
    fontStyle: (fm.is_italic as boolean) ? "italic" : "normal",
    fill: (block as any).is_invisible
      ? "transparent"
      : ((fm.color as string) || "#111111"),
    textAlign: ((block as any).alignment ?? "left") as
      | "left"
      | "center"
      | "right"
      | "justify",
    text: block.content ?? "",
    lineHeight: 1.25,
  };
}
