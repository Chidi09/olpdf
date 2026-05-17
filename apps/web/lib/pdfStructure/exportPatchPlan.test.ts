import { describe, expect, it } from "vitest";
import type { PdfDocumentOperation, PdfStructuredBlock } from "@/types/nativePdf";
import { planExportPatch } from "./exportPatchPlan";

const textBlock: PdfStructuredBlock = {
  id: "block-1",
  kind: "flow_text",
  pageIndex: 0,
  bbox: [72, 100, 320, 148],
  confidence: 0.94,
  editability: { mode: "flow_text", confidence: 0.94, reasons: [], allowedOperations: ["replace_text", "format_text", "delete"] },
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
          sourceRefs: [{ pageIndex: 0, streamRef: "10 0 R", objectRef: "12 0 R" }],
        },
      ],
    },
  ],
  sourceRefs: [{ pageIndex: 0, streamRef: "10 0 R", objectRef: "12 0 R" }],
};

const imageBlock: PdfStructuredBlock = {
  id: "block-2",
  kind: "image",
  pageIndex: 0,
  bbox: [72, 200, 320, 400],
  confidence: 0.9,
  editability: { mode: "replaceable_image", confidence: 0.9, reasons: [], allowedOperations: ["replace_image", "move", "resize", "delete"] },
  sourceRefs: [{ pageIndex: 0, objectRef: "20 0 R" }],
};

const replaceOp: PdfDocumentOperation = {
  id: "op-1",
  type: "replace_run_text",
  blockId: "block-1",
  before: { runId: "run-1", text: "Hello world" },
  after: { runId: "run-1", text: "Goodbye world" },
  createdAt: new Date().toISOString(),
};

describe("planExportPatch", () => {
  it("creates patch_text_operator plan for safe text replace with source refs", () => {
    const plan = planExportPatch(textBlock, replaceOp);
    expect(plan.kind).toBe("patch_text_operator");
    expect(plan.sourceRef).toBe("12 0 R");
    expect(plan.before).toBe("Hello world");
    expect(plan.after).toBe("Goodbye world");
  });

  it("creates overlay_text plan for text replace without source refs", () => {
    const blockNoRef: PdfStructuredBlock = {
      ...textBlock,
      sourceRefs: [],
      lines: [{
        ...textBlock.lines![0],
        runs: [{ ...textBlock.lines![0].runs[0], sourceRefs: [] }],
      }],
    };
    const plan = planExportPatch(blockNoRef, replaceOp);
    expect(plan.kind).toBe("overlay_text");
  });

  it("creates replace_image_xobject plan for image replacement with object ref", () => {
    const replaceImageOp: PdfDocumentOperation = {
      id: "op-2",
      type: "replace_image",
      blockId: "block-2",
      before: {},
      after: { imageUrl: "https://example.com/new.png" },
      createdAt: new Date().toISOString(),
    };
    const plan = planExportPatch(imageBlock, replaceImageOp);
    expect(plan.kind).toBe("replace_image_xobject");
    expect(plan.sourceRef).toBe("20 0 R");
  });
});
