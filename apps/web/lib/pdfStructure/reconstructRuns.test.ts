import { describe, expect, it } from "vitest";
import type { PdfGlyph } from "@/types/nativePdf";
import { clusterGlyphsIntoRuns } from "./reconstructRuns";

const glyph = (id: string, char: string, x0: number, x1: number): PdfGlyph => ({
  id,
  char,
  bbox: [x0, 100, x1, 112],
  baseline: 110,
  fontFamily: "Helvetica",
  fontSize: 12,
  color: "#111111",
  sourceRef: { pageIndex: 0, streamRef: "10 0 R" },
});

describe("clusterGlyphsIntoRuns", () => {
  it("groups adjacent glyphs with matching style into one run", () => {
    const runs = clusterGlyphsIntoRuns([
      glyph("g1", "H", 10, 17),
      glyph("g2", "i", 18, 21),
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe("Hi");
    expect(runs[0].bbox).toEqual([10, 100, 21, 112]);
  });

  it("starts a new run when style changes", () => {
    const second = { ...glyph("g2", "i", 18, 21), color: "#ff0000" };
    const runs = clusterGlyphsIntoRuns([glyph("g1", "H", 10, 17), second]);

    expect(runs).toHaveLength(2);
  });
});
