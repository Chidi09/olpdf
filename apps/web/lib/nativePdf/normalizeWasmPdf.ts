import type { PdfEditSession, PdfNativeObject, WasmParseResult as NativeWasmParseResult } from "@/types/nativePdf";

// The WASM bridge returns a raw object that might have different snake_case naming
// than our camelCase frontend types. This local interface represents the RAW WASM bridge output.
export interface WasmBridgeOutput {
  metrics: {
    duration_ms: number;
    total_blocks: number;
    unmapped_chars: number;
    pages_failed: number;
    warnings: string[];
    image_count: number;
    missing_fonts_count: number;
    is_likely_scanned: boolean;
  };
  blocks: Array<{
    id: string;
    object_id: string;
    source_ref: string;
    type: string;
    content: string;
    rich_spans: Array<{
      text: string;
      bold: boolean;
      italic: boolean;
      underline: boolean;
      strikethrough: boolean;
      font_family?: string;
      font_size?: number;
      vertical_align?: string;
      color?: string;
    }>;
    page_index: number;
    bounding_box: [number, number, number, number];
    font_meta: { family: string; size: number; color: string; is_bold: boolean; is_italic: boolean };
    z_index: number;
    bullet?: string;
    alignment: string;
    is_invisible: boolean;
  }>;
  page_dimensions: Array<{ page_index: number; width: number; height: number }>;
}

export function normalizeWasmResult(result: WasmBridgeOutput, documentId: string, originalObjectKey: string): PdfEditSession {
  if (result.metrics) {
    console.info("[pdf-wasm] parse metrics:", {
      duration: `${result.metrics.duration_ms.toFixed(2)}ms`,
      blocks: result.metrics.total_blocks,
      unmapped: result.metrics.unmapped_chars,
      failedPages: result.metrics.pages_failed,
      images: result.metrics.image_count,
      missingFonts: result.metrics.missing_fonts_count,
      scanned: result.metrics.is_likely_scanned,
    });
    if (result.metrics.warnings.length > 0) {
      console.warn("[pdf-wasm] warnings:", result.metrics.warnings);
    }
  }

  const objects: PdfNativeObject[] = result.blocks.map((block) => ({
    id: block.object_id,
    pageIndex: block.page_index,
    type: block.type === "list_item" ? "list_item" : "text",
    bbox: block.bounding_box,
    text: block.content,
    fontFamily: block.font_meta?.family,
    fontSize: block.font_meta?.size,
    color: block.font_meta?.color,
    zIndex: block.z_index,
    sourceRef: block.source_ref,
    rich_spans: block.rich_spans.map(s => ({
      ...s,
      vertical_align: s.vertical_align as "super" | "sub" | undefined
    })),
    bullet: block.bullet,
    is_invisible: block.is_invisible,
    alignment: block.alignment as "left" | "center" | "right" | "justify",
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
    status: result.metrics.pages_failed > 0 ? "partial" : "ready",
    source: "wasm",
    parseMetrics: result.metrics,
    lastSyncedAt: new Date().toISOString(),
  };
}
