import { describe, expect, it, beforeEach } from "vitest";
import { usePageLayoutStore } from "./usePageLayoutStore";
import type { PageLayoutDocument, TextFrame } from "@/types/pageLayout";

function makeTestDoc(): PageLayoutDocument {
  return {
    id: "doc-1",
    source: { kind: "imported_pdf", originalPdfKey: "documents/doc-1.pdf" },
    pages: [
      {
        id: "page-0",
        index: 0,
        width: 612,
        height: 792,
        objects: [
          {
            id: "obj-1", type: "text", content: "Hello",
            fontFamily: "Inter", fontSize: 12, fontWeight: "normal", fontStyle: "normal",
            underline: false, color: "#111", textAlign: "left", lineHeight: 1.25, letterSpacing: 0,
            bullets: false, numbering: false,
            visible: true, locked: false, zIndex: 0, opacity: 1, x: 72, y: 100, width: 400, height: 30, rotation: 0,
          },
        ],
      },
      {
        id: "page-1",
        index: 1,
        width: 612,
        height: 792,
        objects: [],
      },
    ],
    styles: {},
    fonts: {},
    assets: {},
    revisions: [],
  };
}

describe("usePageLayoutStore", () => {
  beforeEach(() => {
    usePageLayoutStore.setState({
      document: null,
      selectedObjectIds: [],
      activePageId: null,
      dirty: false,
    });
  });

  it("sets document and selects first page", () => {
    const doc = makeTestDoc();
    usePageLayoutStore.getState().setDocument(doc);

    const state = usePageLayoutStore.getState();
    expect(state.document?.id).toBe("doc-1");
    expect(state.activePageId).toBe("page-0");
    expect(state.dirty).toBe(false);
  });

  it("selects and deselects objects", () => {
    const doc = makeTestDoc();
    usePageLayoutStore.getState().setDocument(doc);
    usePageLayoutStore.getState().selectObject("obj-1");

    expect(usePageLayoutStore.getState().selectedObjectIds).toEqual(["obj-1"]);

    usePageLayoutStore.getState().selectObject(null);
    expect(usePageLayoutStore.getState().selectedObjectIds).toEqual([]);
  });

  it("updates an object", () => {
    const doc = makeTestDoc();
    usePageLayoutStore.getState().setDocument(doc);
    usePageLayoutStore.getState().updateObject("page-0", "obj-1", { content: "Updated" });

    const obj = usePageLayoutStore.getState().document?.pages[0].objects[0] as TextFrame;
    expect(obj.content).toBe("Updated");
    expect(usePageLayoutStore.getState().dirty).toBe(true);
  });

  it("inserts a text frame via insertTextFrame", () => {
    const doc = makeTestDoc();
    usePageLayoutStore.getState().setDocument(doc);
    usePageLayoutStore.getState().insertTextFrame("page-0", 100, 200, "Typed text");

    const objects = usePageLayoutStore.getState().document?.pages[0].objects;
    expect(objects).toHaveLength(2);
    const inserted = objects?.[1] as TextFrame;
    expect(inserted.type).toBe("text");
    expect(inserted.content).toBe("Typed text");
    expect(inserted.x).toBe(100);
    expect(inserted.y).toBe(200);
  });

  it("inserts an object", () => {
    const doc = makeTestDoc();
    usePageLayoutStore.getState().setDocument(doc);

    const newObj: TextFrame = {
      id: "obj-2", type: "text", content: "New",
      fontFamily: "Inter", fontSize: 14, fontWeight: "normal", fontStyle: "normal",
      underline: false, color: "#111", textAlign: "left", lineHeight: 1.25, letterSpacing: 0,
      bullets: false, numbering: false,
      visible: true, locked: false, zIndex: 1, opacity: 1, x: 72, y: 300, width: 200, height: 20, rotation: 0,
    };
    usePageLayoutStore.getState().insertObject("page-0", newObj);

    const objects = usePageLayoutStore.getState().document?.pages[0].objects;
    expect(objects).toHaveLength(2);
    expect(objects?.[1].id).toBe("obj-2");
  });

  it("deletes an object", () => {
    const doc = makeTestDoc();
    usePageLayoutStore.getState().setDocument(doc);
    usePageLayoutStore.getState().deleteObject("page-0", "obj-1");

    const objects = usePageLayoutStore.getState().document?.pages[0].objects;
    expect(objects).toHaveLength(0);
  });

  it("reorders pages", () => {
    const doc = makeTestDoc();
    usePageLayoutStore.getState().setDocument(doc);
    usePageLayoutStore.getState().reorderPages(0, 1);

    const pages = usePageLayoutStore.getState().document?.pages;
    expect(pages?.[0].index).toBe(0);
    expect(pages?.[0].id).toBe("page-1");
  });

  it("deletes selected objects", () => {
    const doc = makeTestDoc();
    usePageLayoutStore.getState().setDocument(doc);
    usePageLayoutStore.getState().selectObject("obj-1");
    usePageLayoutStore.getState().deleteSelectedObjects();

    const objects = usePageLayoutStore.getState().document?.pages[0].objects;
    expect(objects).toHaveLength(0);
    expect(usePageLayoutStore.getState().selectedObjectIds).toEqual([]);
    expect(usePageLayoutStore.getState().dirty).toBe(true);
  });

  it("moveObject updates x,y and marks dirty", () => {
    const doc = makeTestDoc();
    usePageLayoutStore.getState().setDocument(doc);
    usePageLayoutStore.getState().moveObject("page-0", "obj-1", 150, 200);

    const obj = usePageLayoutStore.getState().document?.pages[0].objects[0];
    expect(obj?.x).toBe(150);
    expect(obj?.y).toBe(200);
    expect(usePageLayoutStore.getState().dirty).toBe(true);
  });

  it("resizeObject updates width,height and marks dirty", () => {
    const doc = makeTestDoc();
    usePageLayoutStore.getState().setDocument(doc);
    usePageLayoutStore.getState().resizeObject("page-0", "obj-1", 500, 60);

    const obj = usePageLayoutStore.getState().document?.pages[0].objects[0];
    expect(obj?.width).toBe(500);
    expect(obj?.height).toBe(60);
    expect(usePageLayoutStore.getState().dirty).toBe(true);
  });

  it("updateTextContent updates text and marks dirty", () => {
    const doc = makeTestDoc();
    usePageLayoutStore.getState().setDocument(doc);
    usePageLayoutStore.getState().updateTextContent("page-0", "obj-1", "Updated text");

    const obj = usePageLayoutStore.getState().document?.pages[0].objects[0];
    expect((obj as any)?.content).toBe("Updated text");
    expect(usePageLayoutStore.getState().dirty).toBe(true);
  });
});
