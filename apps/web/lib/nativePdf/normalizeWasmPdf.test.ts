import { describe, expect, it } from "vitest";
import type { WasmGlyphPayload } from "@/types/nativePdf";
import { normalizeWasmGlyphs } from "./normalizeWasmPdf";

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
