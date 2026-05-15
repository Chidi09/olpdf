import { Textbox, Rect, Ellipse, Line, Group, FabricImage, type FabricObject } from "fabric";
import type { LayoutObject } from "@/types/pageLayout";

export type FabricObjectMeta = {
  layoutObjectId: string;
  layoutObjectType: string;
  pageId?: string;
};

export type FabricObjectSpec =
  | { kind: "textbox"; data: { layoutObjectId: string; layoutObjectType: string; pageId?: string }; options: Record<string, unknown> }
  | { kind: "image"; data: { layoutObjectId: string; layoutObjectType: string; pageId?: string }; options: Record<string, unknown> }
  | { kind: "rect"; data: { layoutObjectId: string; layoutObjectType: string; pageId?: string }; options: Record<string, unknown> }
  | { kind: "ellipse"; data: { layoutObjectId: string; layoutObjectType: string; pageId?: string }; options: Record<string, unknown> }
  | { kind: "line"; data: { layoutObjectId: string; layoutObjectType: string; pageId?: string }; options: Record<string, unknown> }
  | { kind: "group"; data: { layoutObjectId: string; layoutObjectType: string; pageId?: string }; options: Record<string, unknown> };

export function fabricSpecFromLayoutObject(obj: LayoutObject, pageId?: string): FabricObjectSpec {
  const baseData = { layoutObjectId: obj.id, layoutObjectType: obj.type, pageId };

  if (obj.type === "text") {
    return {
      kind: "textbox",
      data: baseData,
      options: {
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fontWeight: obj.fontWeight,
        fontStyle: obj.fontStyle,
        fill: obj.color,
        textAlign: obj.textAlign as "left" | "center" | "right",
        lineHeight: obj.lineHeight,
        charSpacing: obj.letterSpacing * 100,
        underline: obj.underline,
        content: obj.content,
        selectable: !obj.locked,
        evented: !obj.locked,
        opacity: obj.opacity,
        angle: obj.rotation,
      },
    };
  }

  if (obj.type === "image") {
    return {
      kind: "image",
      data: baseData,
      options: {
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        src: obj.src,
        selectable: !obj.locked,
        evented: !obj.locked,
        opacity: obj.opacity,
        angle: obj.rotation,
      },
    };
  }

  if (obj.type === "shape") {
    if (obj.shapeType === "ellipse" || obj.shapeType === "circle") {
      return {
        kind: "ellipse",
        data: baseData,
        options: {
          left: obj.x,
          top: obj.y,
          rx: obj.width / 2,
          ry: obj.height / 2,
          stroke: obj.stroke,
          strokeWidth: obj.strokeWidth,
          fill: obj.fill,
          selectable: !obj.locked,
          evented: !obj.locked,
          opacity: obj.opacity,
          angle: obj.rotation,
        },
      };
    }
    if (obj.shapeType === "line" || obj.shapeType === "arrow") {
      return {
        kind: "line",
        data: baseData,
        options: {
          x1: 0,
          y1: 0,
          x2: obj.width,
          y2: obj.height,
          left: obj.x,
          top: obj.y,
          stroke: obj.stroke,
          strokeWidth: obj.strokeWidth,
          selectable: !obj.locked,
          evented: !obj.locked,
          opacity: obj.opacity,
          angle: obj.rotation,
        },
      };
    }
    return {
      kind: "rect",
      data: baseData,
      options: {
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        rx: obj.shapeType === "rounded_rect" ? 8 : 0,
        ry: obj.shapeType === "rounded_rect" ? 8 : 0,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        fill: obj.fill,
        selectable: !obj.locked,
        evented: !obj.locked,
        opacity: obj.opacity,
        angle: obj.rotation,
      },
    };
  }

  if (obj.type === "table") {
    return {
      kind: "group",
      data: baseData,
      options: {
        left: obj.x,
        top: obj.y,
        selectable: !obj.locked,
        evented: !obj.locked,
        opacity: obj.opacity,
        angle: obj.rotation,
      },
    };
  }

  return {
    kind: "textbox",
    data: baseData,
    options: {
      left: obj.x,
      top: obj.y,
      width: obj.width,
      height: obj.height,
      content: "",
      selectable: !obj.locked,
      evented: !obj.locked,
      opacity: obj.opacity,
      angle: obj.rotation,
    },
  };
}

export function createFabricObject(
  spec: FabricObjectSpec,
  meta: FabricObjectMeta,
): FabricObject | null {
  const data = { ...meta };

  if (spec.kind === "textbox") {
    const tb = new Textbox(String(spec.options.content ?? ""), {
      ...spec.options,
    } as Record<string, unknown>);
    (tb as unknown as { data: FabricObjectMeta }).data = data;
    return tb;
  }

  if (spec.kind === "rect") {
    const r = new Rect(spec.options);
    (r as unknown as { data: FabricObjectMeta }).data = data;
    return r;
  }

  if (spec.kind === "ellipse") {
    const e = new Ellipse(spec.options);
    (e as unknown as { data: FabricObjectMeta }).data = data;
    return e;
  }

  if (spec.kind === "line") {
    const l = new Line([0, 0, 0, 0], spec.options);
    (l as unknown as { data: FabricObjectMeta }).data = data;
    return l;
  }

  if (spec.kind === "group") {
    const g = new Group([], spec.options);
    (g as unknown as { data: FabricObjectMeta }).data = data;
    return g;
  }

  if (spec.kind === "image") {
    const img = new FabricImage(new window.Image(), spec.options);
    (img as unknown as { data: FabricObjectMeta }).data = data;
    return img;
  }

  return null;
}
