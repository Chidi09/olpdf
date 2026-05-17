import type { PdfEditSession, PdfEditSessionStatus, PdfGlyph, PdfNativeObject, PdfNativeObjectType, WasmGlyphPayload, WasmParseResult } from "@/types/nativePdf";

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
    pageIndex: b.page_index,
    type: b.type as PdfNativeObjectType,
    bbox: b.bounding_box,
    text: b.content,
    fontFamily: b.font_meta?.family,
    fontSize: b.font_meta?.size,
    color: b.font_meta?.color,
    zIndex: b.z_index,
    sourceRef: b.source_ref,
    is_invisible: b.is_invisible,
    rich_spans: b.rich_spans,
    alignment: b.alignment,
  }));

  const validStatuses: PdfEditSessionStatus[] = ["failed", "partial", "parsing", "ready"];
  const resolvedStatus: PdfEditSessionStatus = validStatuses.includes(status as PdfEditSessionStatus)
    ? (status as PdfEditSessionStatus)
    : "ready";

  return {
    documentId,
    originalObjectKey: documentId,
    pages: (wasmResult.page_dimensions ?? []).map((d) => ({
      pageIndex: d.page_index,
      width: d.width,
      height: d.height,
    })),
    objects,
    glyphs: wasmResult.glyphs ? normalizeWasmGlyphs(wasmResult.glyphs) : undefined,
    layoutObjects: (wasmResult.layout_objects ?? []).map((lo) => ({
      id: lo.id,
      type: lo.type,
      pageIndex: lo.page_index,
      x: lo.x,
      y: lo.y,
      width: lo.width,
      height: lo.height,
      rotation: lo.rotation,
      zIndex: lo.z_index,
      sourceRef: lo.source_ref ?? "",
      originalPdfObjectId: lo.original_pdf_object_id ?? "",
      content: lo.content,
      fontFamily: lo.font_family,
      fontSize: lo.font_size,
      color: lo.color,
      textAlign: lo.text_align,
    })),
    operations: [],
    status: resolvedStatus,
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
