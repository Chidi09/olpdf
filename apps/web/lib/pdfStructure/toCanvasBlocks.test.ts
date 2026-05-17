import { describe, expect, it } from "vitest";
import type { PdfStructuredBlock } from "@/types/nativePdf";
import { toCanvasBlocks } from "./toCanvasBlocks";

const textBlock: PdfStructuredBlock = {
  id: "block-1",
  kind: "flow_text",
  pageIndex: 0,
  bbox: [72, 100, 320, 148],
  confidence: 0.94,
  editability: {
    mode: "flow_text",
    confidence: 0.94,
    reasons: [],
    allowedOperations: ["replace_text", "format_text", "delete"],
  },
  lines: [
    {
      id: "line-1",
      bbox: [72, 100, 320, 124],
      baseline: 120,
      runs: [
        {
          id: "run-1",
          text: "Hello world",
          bbox: [72, 100, 320, 124],
          baseline: 120,
          fontFamily: "Helvetica",
          fontSize: 12,
          color: "#111111",
          glyphs: [],
          sourceRefs: [{ pageIndex: 0, streamRef: "10 0 R" }],
        },
      ],
    },
  ],
  sourceRefs: [{ pageIndex: 0, streamRef: "10 0 R" }],
};

const imageBlock: PdfStructuredBlock = {
  id: "block-2",
  kind: "image",
  pageIndex: 0,
  bbox: [72, 200, 320, 400],
  confidence: 0.9,
  editability: {
    mode: "replaceable_image",
    confidence: 0.9,
    reasons: [],
    allowedOperations: ["replace_image", "move", "resize", "delete"],
  },
  sourceRefs: [{ pageIndex: 0, objectRef: "20 0 R" }],
};

describe("toCanvasBlocks", () => {
  it("converts flow_text block to editable canvas block with text content", () => {
    const result = toCanvasBlocks([textBlock]);

    expect(result).toHaveLength(1);
    expect(result[0].blockId).toBe("block-1");
    expect(result[0].kind).toBe("flow_text");
    expect(result[0].text).toBe("Hello world");
    expect(result[0].bbox).toEqual([72, 100, 320, 148]);
    expect(result[0].editability.mode).toBe("flow_text");
  });

  it("converts image block to selectable atomic frame", () => {
    const result = toCanvasBlocks([imageBlock]);

    expect(result).toHaveLength(1);
    expect(result[0].blockId).toBe("block-2");
    expect(result[0].kind).toBe("image");
    expect(result[0].text).toBeUndefined();
    expect(result[0].editability.mode).toBe("replaceable_image");
  });
});
