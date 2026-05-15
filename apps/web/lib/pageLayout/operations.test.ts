import { describe, expect, it } from "vitest";
import { operationsFromLayoutDiff, validateLayoutOperations } from "./operations";
import type { PageLayoutDocument } from "@/types/pageLayout";

function makePageDoc(objects: any[] = []): PageLayoutDocument {
  return {
    id: "doc-1",
    source: { kind: "imported_pdf", originalPdfKey: "documents/doc-1.pdf" },
    pages: [{ id: "page-0", index: 0, width: 612, height: 792, objects }],
    styles: {},
    fonts: {},
    assets: {},
    revisions: [],
  };
}

const textObj = {
  id: "obj-1", type: "text" as const,
  content: "Hello", fontFamily: "Inter", fontSize: 12,
  fontWeight: "normal" as const, fontStyle: "normal" as const,
  underline: false, color: "#111", textAlign: "left" as const,
  lineHeight: 1.25, letterSpacing: 0, bullets: false, numbering: false,
  visible: true, locked: false, zIndex: 0, opacity: 1,
  x: 72, y: 100, width: 400, height: 30, rotation: 0,
};

describe("operationsFromLayoutDiff", () => {
  it("detects new text insertion", () => {
    const original = makePageDoc([textObj]);
    const current = makePageDoc([textObj, { ...textObj, id: "obj-2", content: "New" }]);
    const ops = operationsFromLayoutDiff(original, current);
    expect(ops.some((o) => o.type === "insert_text")).toBe(true);
  });

  it("detects move operation", () => {
    const original = makePageDoc([textObj]);
    const current = makePageDoc([{ ...textObj, x: 200, y: 300 }]);
    const ops = operationsFromLayoutDiff(original, current);
    expect(ops.some((o) => o.type === "move_object")).toBe(true);
  });

  it("detects resize operation", () => {
    const original = makePageDoc([textObj]);
    const current = makePageDoc([{ ...textObj, width: 500, height: 100 }]);
    const ops = operationsFromLayoutDiff(original, current);
    expect(ops.some((o) => o.type === "resize_object")).toBe(true);
  });

  it("detects text content change", () => {
    const original = makePageDoc([textObj]);
    const current = makePageDoc([{ ...textObj, content: "Updated" }]);
    const ops = operationsFromLayoutDiff(original, current);
    expect(ops.some((o) => o.type === "update_text")).toBe(true);
  });

  it("returns empty when nothing changed", () => {
    const original = makePageDoc([textObj]);
    const current = makePageDoc([textObj]);
    const ops = operationsFromLayoutDiff(original, current);
    expect(ops).toHaveLength(0);
  });
});

describe("validateLayoutOperations", () => {
  it("rejects move operations for missing objects", () => {
    const doc = makePageDoc([{ ...textObj, id: "existing" }]);
    const errors = validateLayoutOperations(
      [{ type: "move_object", pageId: "page-0", objectId: "missing", x: 10, y: 10 }],
      doc,
    );
    expect(errors).toContain("move_object references missing object missing");
  });

  it("rejects negative resize dimensions", () => {
    const doc = makePageDoc([{ ...textObj, id: "existing" }]);
    const errors = validateLayoutOperations(
      [{ type: "resize_object", pageId: "page-0", objectId: "existing", width: -1, height: 20 }],
      doc,
    );
    expect(errors).toContain("resize_object for existing has invalid dimensions");
  });

  it("rejects operations for missing page", () => {
    const doc = makePageDoc([]);
    const errors = validateLayoutOperations(
      [{ type: "insert_text", pageId: "nonexistent-page", object: textObj }],
      doc,
    );
    expect(errors).toContain("insert_text references missing page nonexistent-page");
  });

  it("returns empty for valid operations", () => {
    const doc = makePageDoc([{ ...textObj, id: "obj-1" }]);
    const errors = validateLayoutOperations(
      [{ type: "move_object", pageId: "page-0", objectId: "obj-1", x: 10, y: 10 }],
      doc,
    );
    expect(errors).toHaveLength(0);
  });
});
