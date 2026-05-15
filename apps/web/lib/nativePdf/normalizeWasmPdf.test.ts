import { describe, expect, it } from "vitest";
import { normalizeWasmResult } from "./normalizeWasmPdf";

describe("normalizeWasmResult", () => {
  it("creates a ready wasm native edit session with parse metrics", () => {
    const session = normalizeWasmResult({
      metrics: {
        duration_ms: 12,
        total_blocks: 1,
        unmapped_chars: 0,
        pages_failed: 0,
        warnings: [],
        image_count: 0,
        missing_fonts_count: 0,
        is_likely_scanned: false,
      },
      blocks: [{
        id: "blk-1",
        object_id: "obj-1",
        source_ref: "12 0 R",
        type: "text",
        content: "Hello",
        rich_spans: [],
        page_index: 0,
        bounding_box: [72, 72, 120, 18],
        font_meta: { family: "Helvetica", size: 12, color: "#000000", is_bold: false, is_italic: false },
        z_index: 0,
        bullet: undefined as unknown as string,
        alignment: "left",
        is_invisible: false,
      }],
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
    }, "doc-1", "documents/doc-1.pdf");

    expect(session.status).toBe("ready");
    expect(session.source).toBe("wasm");
    expect(session.parseMetrics?.total_blocks).toBe(1);
  });

  it("marks session as partial when pages failed", () => {
    const session = normalizeWasmResult({
      metrics: {
        duration_ms: 5,
        total_blocks: 0,
        unmapped_chars: 0,
        pages_failed: 2,
        warnings: ["page 3 failed"],
        image_count: 0,
        missing_fonts_count: 0,
        is_likely_scanned: false,
      },
      blocks: [],
      page_dimensions: [],
    }, "doc-1", "documents/doc-1.pdf");

    expect(session.status).toBe("partial");
  });

  it("preserves layout objects emitted by wasm", () => {
    const session = normalizeWasmResult({
      metrics: {
        duration_ms: 12,
        total_blocks: 1,
        unmapped_chars: 0,
        pages_failed: 0,
        warnings: [],
        image_count: 0,
        missing_fonts_count: 0,
        is_likely_scanned: false,
      },
      blocks: [],
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      layout_objects: [
        {
          id: "text_p0_abcd",
          type: "text",
          page_index: 0,
          x: 72,
          y: 96,
          width: 120,
          height: 24,
          rotation: 0,
          z_index: 3,
          source_ref: "page:0:content:1",
          original_pdf_object_id: "text_p0_abcd",
          content: "Hello",
          font_family: "Helvetica",
          font_size: 12,
          color: "#111111",
          text_align: "left",
        },
      ],
    }, "doc-1", "objects/doc.pdf");

    expect(session.layoutObjects).toBeDefined();
    expect(session.layoutObjects).toHaveLength(1);
    expect(session.layoutObjects![0]).toMatchObject({
      id: "text_p0_abcd",
      type: "text",
      pageIndex: 0,
      x: 72,
      y: 96,
      content: "Hello",
    });
  });

  it("omits layoutObjects when empty", () => {
    const session = normalizeWasmResult({
      metrics: {
        duration_ms: 5,
        total_blocks: 0,
        unmapped_chars: 0,
        pages_failed: 0,
        warnings: [],
        image_count: 0,
        missing_fonts_count: 0,
        is_likely_scanned: false,
      },
      blocks: [],
      page_dimensions: [],
      layout_objects: [],
    }, "doc-1", "objects/doc.pdf");

    expect(session.layoutObjects).toBeUndefined();
  });
});
