import { describe, expect, it } from "vitest";
import { pageLayoutFromDocumentModel } from "./fromNativePdf";
import type { DocumentModel } from "@olpdf/document-model";

describe("pageLayoutFromDocumentModel", () => {
  it("creates pages from native_pdf_session when available", () => {
    const model = {
      id: "doc-1",
      meta: {
        native_pdf_session: {
          documentId: "doc-1",
          originalObjectKey: "documents/doc-1.pdf",
          pages: [
            { pageIndex: 0, width: 612, height: 792 },
            { pageIndex: 1, width: 612, height: 792 },
          ],
          objects: [
            {
              id: "obj-1", pageIndex: 0, type: "text", bbox: [72, 100, 400, 30],
              text: "Hello", fontFamily: "Inter", fontSize: 12, color: "#111",
            },
            {
              id: "obj-2", pageIndex: 0, type: "image", bbox: [72, 200, 200, 150],
            },
          ],
          operations: [],
          status: "ready",
          source: "wasm",
        },
      },
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      blocks: [],
      styles: {},
    } as unknown as DocumentModel;

    const layout = pageLayoutFromDocumentModel(model);

    expect(layout.source.kind).toBe("imported_pdf");
    expect(layout.pages).toHaveLength(2);
    expect(layout.pages[0].index).toBe(0);
    expect(layout.pages[0].width).toBe(612);

    const objects = layout.pages[0].objects;
    expect(objects).toHaveLength(2);
    expect(objects[0].type).toBe("text");
    if (objects[0].type === "text") {
      expect(objects[0].content).toBe("Hello");
      expect(objects[0].fontFamily).toBe("Inter");
    }
    expect(objects[1].type).toBe("image");
  });

  it("falls back to page_dimensions when no native session exists", () => {
    const model = {
      id: "doc-2",
      meta: { title: "Doc" },
      blocks: [],
      page_dimensions: [{ page_index: 0, width: 595, height: 841 }],
      styles: {},
    } as unknown as DocumentModel;

    const layout = pageLayoutFromDocumentModel(model);

    expect(layout.source.kind).toBe("writer_doc");
    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0].width).toBe(595);
    expect(layout.pages[0].height).toBe(841);
  });

  it("falls back to a default A4 page when no dimensions exist", () => {
    const model = {
      id: "doc-3",
      meta: {},
      blocks: [],
      page_dimensions: [],
      styles: {},
    } as unknown as DocumentModel;

    const layout = pageLayoutFromDocumentModel(model);

    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0].width).toBe(595.28);
    expect(layout.pages[0].height).toBe(841.89);
  });

  it("uses wasm layout objects when present in native session", () => {
    const model = {
      id: "doc-4",
      meta: {
        native_pdf_session: {
          documentId: "doc-4",
          originalObjectKey: "objects/doc.pdf",
          pages: [{ pageIndex: 0, width: 612, height: 792 }],
          objects: [
            {
              id: "legacy", pageIndex: 0, type: "text", bbox: [1, 2, 3, 4],
              text: "Legacy", fontFamily: "Inter", fontSize: 11, color: "#111",
            },
          ],
          layoutObjects: [
            {
              id: "layout-1",
              type: "text",
              pageIndex: 0,
              x: 72,
              y: 96,
              width: 120,
              height: 24,
              rotation: 0,
              zIndex: 5,
              sourceRef: "page:0:content:1",
              originalPdfObjectId: "layout-1",
              content: "Layout",
              fontFamily: "Helvetica",
              fontSize: 12,
              color: "#111111",
              textAlign: "left",
            },
          ],
          operations: [],
          status: "ready",
          source: "wasm",
        },
      },
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      blocks: [],
      styles: {},
    } as unknown as DocumentModel;

    const layout = pageLayoutFromDocumentModel(model);
    expect(layout.pages[0].objects).toHaveLength(1);
    expect(layout.pages[0].objects[0]).toMatchObject({ id: "layout-1", content: "Layout", x: 72 });
  });

  it("converts native session object bbox from corners to size", () => {
    const model = {
      id: "doc-corners",
      meta: {
        native_pdf_session: {
          documentId: "doc-corners",
          originalObjectKey: "objects/doc.pdf",
          pages: [{ pageIndex: 0, width: 612, height: 792 }],
          objects: [
            {
              id: "obj-corners",
              pageIndex: 0,
              type: "text",
              bbox: [72, 100, 400, 130],
              text: "Corner bbox",
              fontFamily: "Inter",
              fontSize: 12,
              color: "#111",
            },
          ],
          operations: [],
          status: "ready",
          source: "wasm",
        },
      },
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      blocks: [],
      styles: {},
    } as unknown as DocumentModel;

    const layout = pageLayoutFromDocumentModel(model);

    expect(layout.pages[0].objects[0]).toMatchObject({
      x: 72,
      y: 100,
      width: 328,
      height: 30,
    });
  });

  it("handles null model gracefully", () => {
    const layout = pageLayoutFromDocumentModel(null);
    expect(layout.pages).toHaveLength(1);
    expect(layout.source.kind).toBe("writer_doc");
  });
});
