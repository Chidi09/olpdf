import { describe, expect, it } from "vitest";
import { getNativeSession } from "@/lib/nativePdf/documentModelAdapter";

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
