import { describe, expect, it } from "vitest";
import type { PdfEditOperation, PdfEditSession } from "./nativePdf";

describe("native PDF session types", () => {
  it("supports original PDF metadata and ordered operations", () => {
    const op: PdfEditOperation = {
      id: "op-1",
      type: "replace_text",
      pageIndex: 0,
      targetObjectId: "obj-1",
      before: { text: "Old" },
      after: { text: "New" },
      createdAt: "2026-05-14T00:00:00.000Z",
    };

    const session: PdfEditSession = {
      documentId: "doc-1",
      originalObjectKey: "documents/doc-1.pdf",
      pages: [{ pageIndex: 0, width: 612, height: 792 }],
      objects: [{ id: "obj-1", pageIndex: 0, type: "text", bbox: [72, 72, 120, 18], text: "Old" }],
      operations: [op],
      status: "ready",
      source: "wasm",
    };

    expect(session.operations[0].targetObjectId).toBe("obj-1");
    expect(session.originalObjectKey).toBe("documents/doc-1.pdf");
  });
});
