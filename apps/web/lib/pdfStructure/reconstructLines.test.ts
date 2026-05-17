import { describe, expect, it } from "vitest";
import type { PdfTextRun } from "@/types/nativePdf";
import { groupRunsIntoLines } from "./reconstructLines";

const run = (id: string, text: string, baseline: number, x0: number): PdfTextRun => ({
  id,
  text,
  bbox: [x0, baseline - 12, x0 + text.length * 6, baseline],
  baseline,
  fontFamily: "Helvetica",
  fontSize: 12,
  color: "#111111",
  glyphs: [],
  sourceRefs: [],
});

describe("groupRunsIntoLines", () => {
  it("groups runs with same baseline into one line", () => {
    const lines = groupRunsIntoLines([
      run("r1", "Hello", 110, 10),
      run("r2", " World", 110, 56),
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0].runs).toHaveLength(2);
  });

  it("splits runs with different baselines into separate lines", () => {
    const lines = groupRunsIntoLines([
      run("r1", "Line1", 110, 10),
      run("r2", "Line2", 130, 10),
    ]);

    expect(lines).toHaveLength(2);
  });
});
