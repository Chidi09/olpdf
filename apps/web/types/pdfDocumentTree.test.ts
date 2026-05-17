import { describe, expect, it } from "vitest";
import type { PdfDocumentTree, PdfStructuredBlock } from "./nativePdf";

describe("PdfDocumentTree types", () => {
  it("models editable flow text with reverse mapping", () => {
    const block: PdfStructuredBlock = {
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
      lines: [],
      sourceRefs: [{ pageIndex: 0, objectRef: "12 0 R", streamRef: "18 0 R" }],
    };

    const tree: PdfDocumentTree = {
      documentId: "doc-1",
      pages: [{ pageIndex: 0, width: 612, height: 792, blocks: [block] }],
      operations: [],
    };

    expect(tree.pages[0].blocks[0].kind).toBe("flow_text");
  });
});
