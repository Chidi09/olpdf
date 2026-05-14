import { describe, expect, it } from "vitest";
import { buildNativeImportPayload } from "./importPayload";

describe("buildNativeImportPayload", () => {
  it("includes native_pdf_session when wasm parse succeeds", () => {
    const payload = buildNativeImportPayload({
      documentId: "doc-1",
      fileBytes: "base64-encoded",
      session: {
        documentId: "doc-1",
        originalObjectKey: "documents/doc-1.pdf",
        pages: [{ pageIndex: 0, width: 612, height: 792 }],
        objects: [{ id: "obj-1", pageIndex: 0, type: "text", bbox: [72, 72, 120, 18], text: "Hello", fontFamily: "Helvetica", fontSize: 12, alignment: "left" }],
        operations: [],
        status: "ready",
        source: "wasm",
      },
    });

    expect(payload.client_model?.meta?.native_pdf_session?.source).toBe("wasm");
    expect(payload.client_model?.meta?.native_pdf).toBe(true);
    expect(payload.client_model?.blocks).toHaveLength(1);
    expect(payload.client_model?.blocks?.[0].content).toBe("Hello");
    expect(payload.client_model?.blocks?.[0].bounding_box).toEqual([72, 72, 120, 18]);
    expect(payload.client_model?.page_dimensions).toHaveLength(1);
  });

  it("omits client_model when no session provided", () => {
    const payload = buildNativeImportPayload({ documentId: "doc-1", fileBytes: "base64" });
    expect(payload.client_model).toBeUndefined();
    expect(payload.layout_mode).toBe("fidelity");
  });
});
