import { describe, expect, it } from "vitest";
import { buildNativeImportPayload } from "./importPayload";
import { normalizeWasmResult } from "@/lib/nativePdf/normalizeWasmPdf";
import type { PdfEditSession, WasmParseResult } from "@/types/nativePdf";

describe("buildNativeImportPayload", () => {
  it("includes native_pdf_session when wasm parse succeeds", () => {
    const payload = buildNativeImportPayload("doc-1", "base64-encoded", {
      documentId: "doc-1",
      originalObjectKey: "documents/doc-1.pdf",
      pages: [{ pageIndex: 0, width: 612, height: 792 }],
      objects: [{ id: "obj-1", pageIndex: 0, type: "text", bbox: [72, 72, 120, 18], text: "Hello", fontFamily: "Helvetica", fontSize: 12, alignment: "left" }],
      operations: [],
      status: "ready",
      source: "wasm",
    } as PdfEditSession);

    expect(payload.client_model.meta.native_pdf_session.source).toBe("wasm");
    expect(payload.client_model.meta.native_pdf).toBe(true);
    expect(payload.client_model.blocks).toHaveLength(1);
    expect(payload.client_model.blocks[0].content).toBe("Hello");
    expect(payload.client_model.blocks[0].bounding_box).toEqual([72, 72, 120, 18]);
    expect(payload.client_model.page_dimensions).toHaveLength(1);
  });

  it("includes native pdf session metadata", () => {
    const session = normalizeWasmResult({
      blocks: [],
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      metrics: { duration_ms: 1, total_blocks: 0, unmapped_chars: 0, pages_failed: 0, warnings: [], image_count: 0, missing_fonts_count: 0, is_likely_scanned: false },
    } as WasmParseResult, "doc-1", "ready");

    const payload = buildNativeImportPayload("doc-1", "base64data", session);
    expect(payload.client_model.meta).toMatchObject({
      native_pdf: true,
      original_pdf_key: expect.any(String),
      layout_mode: "fidelity",
    });
    expect(payload.client_model.meta.native_pdf_session).toBeTruthy();
    expect(payload.client_model.page_dimensions).toBeDefined();
    expect(payload.client_model.blocks).toBeDefined();
  });
});
