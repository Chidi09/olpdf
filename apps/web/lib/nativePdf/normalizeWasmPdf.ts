import type { PdfEditSession, PdfGlyph, PdfNativeObject, WasmGlyphPayload, WasmParseResult } from "@/types/nativePdf";

export function normalizeWasmGlyphs(wasmGlyphs: WasmGlyphPayload[]): PdfGlyph[] {
  return wasmGlyphs.map((wg) => ({
    id: wg.id,
    char: wg.char,
    bbox: wg.bbox,
    baseline: wg.bbox[3],
    fontFamily: wg.font_family,
    fontSize: wg.font_size,
    color: wg.color,
    sourceRef: {
      pageIndex: wg.page_index,
    },
  }));
}

export function normalizeWasmResult(
  wasmResult: WasmParseResult,
  documentId: string,
  status?: string
): PdfEditSession {
  const objects: PdfNativeObject[] = (wasmResult.blocks ?? []).map((b) => ({
    id: b.id,
    pageIndex: b.pageIndex,
    type: b.type,
    bbox: b.bbox,
    text: b.text,
    fontFamily: b.fontFamily,
    fontSize: b.fontSize,
    color: b.color,
    zIndex: b.zIndex,
    sourceRef: b.sourceRef,
  }));

  return {
    documentId,
    originalObjectKey: documentId,
    pages: (wasmResult.page_dimensions ?? []).map((d) => ({
      pageIndex: d.page_index,
      width: d.width,
      height: d.height,
    })),
    objects,
    operations: [],
    status: (status as PdfEditSession["status"]) ?? "ready",
    source: "wasm",
    parseMetrics: wasmResult.metrics
      ? {
          duration_ms: wasmResult.metrics.duration_ms,
          total_blocks: wasmResult.metrics.total_blocks,
          unmapped_chars: wasmResult.metrics.unmapped_chars,
          pages_failed: wasmResult.metrics.pages_failed,
          warnings: wasmResult.metrics.warnings,
          image_count: wasmResult.metrics.image_count,
          missing_fonts_count: wasmResult.metrics.missing_fonts_count,
          is_likely_scanned: wasmResult.metrics.is_likely_scanned,
        }
      : undefined,
  };
}
