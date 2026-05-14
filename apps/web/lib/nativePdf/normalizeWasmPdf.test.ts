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
});
