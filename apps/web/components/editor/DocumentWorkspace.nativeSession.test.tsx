import { describe, expect, it, vi, beforeEach } from "vitest";
import { getNativeSession } from "@/lib/nativePdf/documentModelAdapter";
import { isImportedPdfDocument, resolveEditorSurface } from "./DocumentWorkspace";

describe("DocumentWorkspace native session", () => {
  it("detects a ready native PDF session from the model", () => {
    const model = {
      id: "doc-1",
      meta: {
        native_pdf_session: {
          documentId: "doc-1",
          originalObjectKey: "documents/doc-1.pdf",
          pages: [{ pageIndex: 0, width: 612, height: 792 }],
          objects: [],
          operations: [],
          status: "ready",
          source: "wasm",
        },
      },
      blocks: [],
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      styles: {},
    } as any;

    const session = getNativeSession(model);
    expect(session?.status).toBe("ready");
  });

  it("returns null for model without native session", () => {
    const model = { id: "doc-1", meta: { title: "Doc" }, blocks: [], page_dimensions: [], styles: {} } as any;
    expect(getNativeSession(model)).toBeNull();
  });
});

describe("resolveEditorSurface", () => {
  it("returns pdf_canvas for imported PDFs", () => {
    expect(resolveEditorSurface({ id: "1", meta: { native_pdf: true, original_pdf_key: "k" }, blocks: [], page_dimensions: [], styles: {} } as any)).toBe("pdf_canvas");
  });

  it("returns writer for documents without native PDF markers", () => {
    expect(resolveEditorSurface({ id: "1", meta: { title: "Doc" }, blocks: [], page_dimensions: [], styles: {} } as any)).toBe("writer");
  });

  it("returns writer for null model", () => {
    expect(resolveEditorSurface(null)).toBe("writer");
  });
});

describe("isImportedPdfDocument", () => {
  it("detects imported PDFs by native_pdf meta flag", () => {
    const model = {
      id: "doc-1", meta: { native_pdf: true }, blocks: [], page_dimensions: [], styles: {},
    } as any;
    expect(isImportedPdfDocument(model)).toBe(true);
  });

  it("detects imported PDFs by original_pdf_key", () => {
    const model = {
      id: "doc-1", meta: { original_pdf_key: "documents/doc-1.pdf" }, blocks: [], page_dimensions: [], styles: {},
    } as any;
    expect(isImportedPdfDocument(model)).toBe(true);
  });

  it("returns false for null model", () => {
    expect(isImportedPdfDocument(null)).toBe(false);
  });

  it("returns false for writer documents", () => {
    const model = {
      id: "doc-1", meta: { title: "My Doc" }, blocks: [], page_dimensions: [], styles: {},
    } as any;
    expect(isImportedPdfDocument(model)).toBe(false);
  });

  it("treats native_pdf documents as imported regardless of layout_mode", () => {
    const model = {
      id: "doc-1",
      meta: { native_pdf: true, layout_mode: "editable", original_pdf_key: "documents/doc-1.pdf" },
      blocks: [],
      page_dimensions: [],
      styles: {},
    } as any;
    expect(isImportedPdfDocument(model)).toBe(true);
  });
});

describe("DocumentWorkspace layout store initialization", () => {
  it("initializes page layout store from imported PDF model via pageLayoutFromDocumentModel", async () => {
    const { pageLayoutFromDocumentModel } = await import("@/lib/pageLayout/fromNativePdf");

    const model = {
      id: "doc-1",
      meta: { native_pdf: true, original_pdf_key: "documents/doc-1.pdf" },
      blocks: [{ id: "b1", content: "Hello", bounding_box: [10, 10, 200, 40], page_index: 0, type: "text" }],
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      styles: {},
    } as any;

    const layout = pageLayoutFromDocumentModel(model);
    expect(layout.source.kind).toBe("imported_pdf");
    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0].width).toBe(612);
    expect(layout.pages[0].objects.length).toBeGreaterThan(0);
  });
});
