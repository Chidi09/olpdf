import { describe, expect, it } from "vitest";
import type { PdfTextLine } from "@/types/nativePdf";
import { groupLinesIntoParagraphBlocks } from "./reconstructParagraphs";

const line = (id: string, baseline: number, x0: number, x1: number): PdfTextLine => ({
  id,
  bbox: [x0, baseline - 12, x1, baseline],
  baseline,
  runs: [],
});

describe("groupLinesIntoParagraphBlocks", () => {
  it("groups nearby same-margin lines into one flow_text block", () => {
    const blocks = groupLinesIntoParagraphBlocks(0, [
      line("l1", 110, 10, 300),
      line("l2", 130, 12, 290),
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("flow_text");
    expect(blocks[0].lines).toHaveLength(2);
  });

  it("splits lines with large vertical gap into separate blocks", () => {
    const blocks = groupLinesIntoParagraphBlocks(0, [
      line("l1", 110, 10, 300),
      line("l2", 300, 10, 300),
    ]);

    expect(blocks).toHaveLength(2);
  });
});
