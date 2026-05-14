import { describe, expect, it } from "vitest";
import { attachNativeSession, getNativeSession } from "./documentModelAdapter";
import type { PdfEditSession } from "@/types/nativePdf";

describe("documentModelAdapter", () => {
  it("stores and retrieves a native PDF edit session under meta.native_pdf_session", () => {
    const session: PdfEditSession = {
      documentId: "doc-1",
      originalObjectKey: "documents/doc-1.pdf",
      pages: [{ pageIndex: 0, width: 612, height: 792 }],
      objects: [],
      operations: [],
      status: "ready",
      source: "wasm",
    };

    const model = attachNativeSession({ id: "doc-1", meta: { title: "PDF" }, blocks: [], page_dimensions: [], styles: {} } as any, session);
    expect(getNativeSession(model)?.originalObjectKey).toBe("documents/doc-1.pdf");
  });

  it("sets native_pdf flag and copies page dimensions", () => {
    const session: PdfEditSession = {
      documentId: "doc-1",
      originalObjectKey: "documents/doc-1.pdf",
      pages: [{ pageIndex: 0, width: 612, height: 792 }, { pageIndex: 1, width: 612, height: 792 }],
      objects: [],
      operations: [],
    };

    const model = attachNativeSession({ id: "doc-1", meta: { title: "PDF" }, blocks: [], page_dimensions: [], styles: {} } as any, session);
    expect((model.meta as any)?.native_pdf).toBe(true);
    expect(model.page_dimensions).toHaveLength(2);
  });

  it("returns null for missing native session", () => {
    expect(getNativeSession({ id: "x", meta: {}, blocks: [], page_dimensions: [], styles: {} } as any)).toBeNull();
    expect(getNativeSession(null)).toBeNull();
  });
});
