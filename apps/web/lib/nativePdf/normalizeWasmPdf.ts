import type { PdfGlyph, WasmGlyphPayload } from "@/types/nativePdf";

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
