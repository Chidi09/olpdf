import type { PdfEditSession, PdfNativeObject } from "@/types/nativePdf";

export interface WasmParseResult {
  source: string;
  blocks: Array<{
    id: string;
    object_id: string;
    source_ref: string;
    type: string;
    content: string;
    rich_spans: Array<{ text: string; bold?: boolean; italic?: boolean; font_family?: string; font_size?: number }>;
    page_index: number;
    bounding_box: [number, number, number, number];
    font_meta: { family: string; size: number; color: string };
    z_index: number;
  }>;
  page_dimensions: Array<{ page_index: number; width: number; height: number }>;
}

export function normalizeWasmResult(result: WasmParseResult, documentId: string, originalObjectKey: string): PdfEditSession {
  const objects: PdfNativeObject[] = result.blocks.map((block) => ({
    id: block.object_id,
    pageIndex: block.page_index,
    type: "text" as const,
    bbox: block.bounding_box,
    text: block.content,
    fontFamily: block.font_meta?.family,
    fontSize: block.font_meta?.size,
    color: block.font_meta?.color,
    zIndex: block.z_index,
    sourceRef: block.source_ref,
  }));

  const pages = result.page_dimensions.map((p) => ({
    pageIndex: p.page_index,
    width: p.width,
    height: p.height,
  }));

  return {
    documentId,
    originalObjectKey,
    pages,
    objects,
    operations: [],
  };
}
