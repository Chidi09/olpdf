import { describe, expect, it } from "vitest";
import { applyOperationToSession } from "./applyOperations";
import type { PdfEditSession } from "@/types/nativePdf";

describe("applyOperationToSession", () => {
  it("replaces text by object id without changing unrelated objects", () => {
    const session: PdfEditSession = {
      documentId: "doc-1",
      originalObjectKey: "documents/doc-1.pdf",
      pages: [{ pageIndex: 0, width: 612, height: 792 }],
      objects: [
        { id: "obj-1", pageIndex: 0, type: "text", bbox: [0, 0, 10, 10], text: "Old" },
        { id: "obj-2", pageIndex: 0, type: "text", bbox: [0, 20, 10, 30], text: "Keep" },
      ],
      operations: [],
    };

    const next = applyOperationToSession(session, {
      id: "op-1",
      type: "replace_text",
      pageIndex: 0,
      targetObjectId: "obj-1",
      before: { text: "Old" },
      after: { text: "New" },
      createdAt: "2026-05-14T00:00:00.000Z",
    });

    expect(next.objects.find((o) => o.id === "obj-1")?.text).toBe("New");
    expect(next.objects.find((o) => o.id === "obj-2")?.text).toBe("Keep");
    expect(next.operations).toHaveLength(1);
  });

  it("handles move_object by updating bbox", () => {
    const session: PdfEditSession = {
      documentId: "doc-1",
      originalObjectKey: "documents/doc-1.pdf",
      pages: [{ pageIndex: 0, width: 612, height: 792 }],
      objects: [{ id: "obj-1", pageIndex: 0, type: "text", bbox: [0, 0, 10, 10], text: "Text" }],
      operations: [],
    };

    const next = applyOperationToSession(session, {
      id: "op-2",
      type: "move_object",
      pageIndex: 0,
      targetObjectId: "obj-1",
      before: { bbox: [0, 0, 10, 10] },
      after: { bbox: [20, 30, 50, 60] },
      createdAt: "now",
    });

    expect(next.objects[0].bbox).toEqual([20, 30, 50, 60]);
  });

  it("handles delete_object by removing the object", () => {
    const session: PdfEditSession = {
      documentId: "doc-1",
      originalObjectKey: "documents/doc-1.pdf",
      pages: [{ pageIndex: 0, width: 612, height: 792 }],
      objects: [
        { id: "obj-1", pageIndex: 0, type: "text", bbox: [0, 0, 10, 10], text: "A" },
        { id: "obj-2", pageIndex: 0, type: "text", bbox: [10, 0, 20, 10], text: "B" },
      ],
      operations: [],
    };

    const next = applyOperationToSession(session, {
      id: "op-3",
      type: "delete_object",
      pageIndex: 0,
      targetObjectId: "obj-1",
      before: {},
      after: {},
      createdAt: "now",
    });

    expect(next.objects).toHaveLength(1);
    expect(next.objects[0].id).toBe("obj-2");
  });

  it("handles insert_text by appending a new object", () => {
    const session: PdfEditSession = {
      documentId: "doc-1",
      originalObjectKey: "documents/doc-1.pdf",
      pages: [{ pageIndex: 0, width: 612, height: 792 }],
      objects: [],
      operations: [],
    };

    const next = applyOperationToSession(session, {
      id: "op-4",
      type: "insert_text",
      pageIndex: 1,
      targetObjectId: "obj-new",
      before: {},
      after: { text: "Hello", bbox: [0, 0, 50, 12] },
      createdAt: "now",
    });

    expect(next.objects).toHaveLength(1);
    expect(next.objects[0].text).toBe("Hello");
    expect(next.objects[0].pageIndex).toBe(1);
  });

  it("records the operation in the operations array", () => {
    const session: PdfEditSession = {
      documentId: "doc-1",
      originalObjectKey: "documents/doc-1.pdf",
      pages: [],
      objects: [],
      operations: [],
    };

    const op = { id: "op-5", type: "replace_text" as const, pageIndex: 0, targetObjectId: "o", before: {}, after: { text: "x" }, createdAt: "now" };
    const next = applyOperationToSession(session, op);

    expect(next.operations).toHaveLength(1);
    expect(next.operations[0].id).toBe("op-5");
  });
});
