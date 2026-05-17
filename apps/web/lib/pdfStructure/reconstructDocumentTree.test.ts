import { describe, expect, it } from "vitest";
import type { PdfGlyph } from "@/types/nativePdf";
import { reconstructDocumentTree } from "./reconstructDocumentTree";

const glyph = (id: string, char: string, x0: number, x1: number, baseline: number): PdfGlyph => ({
  id,
  char,
  bbox: [x0, baseline - 12, x1, baseline],
  baseline,
  fontFamily: "Helvetica",
  fontSize: 12,
  color: "#111111",
  sourceRef: { pageIndex: 0, streamRef: "10 0 R" },
});

describe("reconstructDocumentTree", () => {
  it("reconstructs one paragraph from adjacent glyphs", () => {
    const tree = reconstructDocumentTree("doc-1", [
      {
        pageIndex: 0,
        width: 612,
        height: 792,
        glyphs: [
          glyph("g1", "H", 10, 17, 110),
          glyph("g2", "i", 18, 21, 110),
        ],
      },
    ]);

    expect(tree.pages).toHaveLength(1);
    expect(tree.pages[0].blocks).toHaveLength(1);
    expect(tree.pages[0].blocks[0].kind).toBe("flow_text");
  });

  it("handles empty glyphs gracefully", () => {
    const tree = reconstructDocumentTree("doc-1", [
      { pageIndex: 0, width: 612, height: 792, glyphs: [] },
    ]);

    expect(tree.pages).toHaveLength(1);
    expect(tree.pages[0].blocks).toHaveLength(0);
  });
});
