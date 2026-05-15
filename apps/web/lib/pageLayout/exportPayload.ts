import type { PageLayoutDocument } from "@/types/pageLayout";

export type LayoutExportPayload = {
  source_kind: string;
  original_pdf_key?: string;
  pages: Array<{
    index: number;
    width: number;
    height: number;
    objects: Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      content?: string;
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: string;
      fontStyle?: string;
      color?: string;
      textAlign?: string;
      src?: string;
      shapeType?: string;
      stroke?: string;
      fill?: string;
    }>;
  }>;
  export_strategy: "preserve_original" | "regenerate";
};

export function buildLayoutExportPayload(
  layout: PageLayoutDocument,
  strategy: "preserve_original" | "regenerate" = "preserve_original"
): LayoutExportPayload {
  return {
    source_kind: layout.source.kind,
    original_pdf_key: layout.source.originalPdfKey,
    pages: layout.pages.map((p) => ({
      index: p.index,
      width: p.width,
      height: p.height,
      objects: p.objects.map((o) => ({
        id: o.id,
        type: o.type,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        rotation: o.rotation,
        content: o.type === "text" ? (o as any).content : undefined,
        fontFamily: o.type === "text" ? (o as any).fontFamily : undefined,
        fontSize: o.type === "text" ? (o as any).fontSize : undefined,
        fontWeight: o.type === "text" ? (o as any).fontWeight : undefined,
        fontStyle: o.type === "text" ? (o as any).fontStyle : undefined,
        color: o.type === "text" ? (o as any).color : undefined,
        textAlign: o.type === "text" ? (o as any).textAlign : undefined,
        src: o.type === "image" ? (o as any).src : undefined,
        shapeType: o.type === "shape" ? (o as any).shapeType : undefined,
        stroke: o.type === "shape" ? (o as any).stroke : undefined,
        fill: o.type === "shape" ? (o as any).fill : undefined,
      })),
    })),
    export_strategy: strategy,
  };
}
