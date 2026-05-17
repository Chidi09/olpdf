import { describe, expect, it } from "vitest";
import type { WasmGlyphPayload, WasmParseResult } from "@/types/nativePdf";
import { normalizeWasmGlyphs, normalizeWasmResult } from "./normalizeWasmPdf";

describe("normalizeWasmGlyphs", () => {
  it("converts a WasmGlyphPayload to PdfGlyph with correct fields", () => {
    const wasmGlyphs: WasmGlyphPayload[] = [
      {
        id: "glyph-0-0",
        char: "H",
        bbox: [10.0, 100.0, 17.0, 112.0],
        font_family: "Helvetica",
        font_size: 12.0,
        color: "#111111",
        page_index: 0,
      },
    ];

    const result = normalizeWasmGlyphs(wasmGlyphs);

    expect(result).toHaveLength(1);
    expect(result[0].char).toBe("H");
    expect(result[0].bbox).toEqual([10, 100, 17, 112]);
    expect(result[0].baseline).toBeCloseTo(112, 0);
    expect(result[0].fontFamily).toBe("Helvetica");
    expect(result[0].fontSize).toBe(12);
    expect(result[0].color).toBe("#111111");
    expect(result[0].sourceRef.pageIndex).toBe(0);
  });
});

describe("normalizeWasmResult", () => {
  it("normalizes snake_case WASM blocks into native session objects", () => {
    const result = normalizeWasmResult({
      blocks: [{
        id: "blk-1",
        object_id: "obj-1",
        source_ref: "page:0:oxide:0",
        type: "text",
        content: "Hello",
        rich_spans: [],
        page_index: 0,
        bounding_box: [10, 20, 110, 40] as const,
        font_meta: { family: "Helvetica", size: 12, color: "#111111", is_bold: false, is_italic: false },
        alignment: "left",
        confidence_score: 1,
        needs_review: false,
        z_index: 3,
        column_index: 0,
        style_overrides: {},
        is_invisible: false,
      }],
      glyphs: [],
      layout_objects: [{
        id: "lo-1",
        type: "text",
        page_index: 0,
        x: 10,
        y: 20,
        width: 100,
        height: 30,
        rotation: 0,
        z_index: 3,
        source_ref: "page:0:oxide:0",
        original_pdf_object_id: "obj-1",
        content: "Hello",
        font_family: "Helvetica",
        font_size: 12,
        color: "#111111",
        text_align: "left",
      }],
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      metrics: {
        duration_ms: 1,
        total_blocks: 1,
        unmapped_chars: 0,
        pages_failed: 0,
        warnings: [],
        image_count: 0,
        missing_fonts_count: 0,
        is_likely_scanned: false,
      },
    }, "doc-1", "ready");

    expect(result.objects[0]).toMatchObject({
      id: "blk-1",
      pageIndex: 0,
      type: "text",
      bbox: [10, 20, 110, 40],
      text: "Hello",
      fontFamily: "Helvetica",
      fontSize: 12,
      color: "#111111",
      zIndex: 3,
      sourceRef: "page:0:oxide:0",
    });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]).toEqual({ pageIndex: 0, width: 612, height: 792 });
    expect(result.layoutObjects!).toHaveLength(1);
    expect(result.layoutObjects![0]).toMatchObject({
      id: "lo-1",
      pageIndex: 0,
      x: 10,
      y: 20,
      width: 100,
      height: 30,
      sourceRef: "page:0:oxide:0",
    });
  });

  it("handles missing blocks, glyphs, and layout_objects gracefully", () => {
    const result = normalizeWasmResult({
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      metrics: { duration_ms: 1, total_blocks: 0, unmapped_chars: 0, pages_failed: 0, warnings: [], image_count: 0, missing_fonts_count: 0, is_likely_scanned: false },
    } as unknown as WasmParseResult, "doc-2", "ready");
    expect(result.objects).toEqual([]);
    expect(result.pages).toHaveLength(1);
    expect(result.glyphs).toBeUndefined();
    expect(result.layoutObjects!).toEqual([]);
  });

  it("rejects invalid status and defaults to ready", () => {
    const result = normalizeWasmResult({
      blocks: [],
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      metrics: { duration_ms: 1, total_blocks: 0, unmapped_chars: 0, pages_failed: 0, warnings: [], image_count: 0, missing_fonts_count: 0, is_likely_scanned: false },
    } as WasmParseResult, "doc-3", "pending" as any);
    expect(result.status).toBe("ready");
  });

  it("passes through glyphs via normalizeWasmGlyphs", () => {
    const result = normalizeWasmResult({
      blocks: [],
      glyphs: [{ id: "g-0", char: "H", bbox: [10, 20, 17, 40], font_family: "Helvetica", font_size: 12, color: "#111", page_index: 0 }],
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      metrics: { duration_ms: 1, total_blocks: 0, unmapped_chars: 0, pages_failed: 0, warnings: [], image_count: 0, missing_fonts_count: 0, is_likely_scanned: false },
    } as WasmParseResult, "doc-4", "ready");
    expect(result.glyphs).toHaveLength(1);
    expect(result.glyphs![0].char).toBe("H");
  });
});
