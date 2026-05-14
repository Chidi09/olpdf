import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNativePdfSession } from "./useNativePdfSession";
import { useNativePdfSessionStore } from "@/store/useNativePdfSessionStore";

describe("useNativePdfSession", () => {
  beforeEach(() => {
    useNativePdfSessionStore.setState({ session: null, isSyncing: false, lastError: null });
    vi.restoreAllMocks();
  });

  it("initializes store session from model meta", () => {
    const model = {
      id: "doc-1",
      meta: {
        title: "PDF",
        native_pdf: true,
        original_pdf_key: "documents/doc-1.pdf",
        native_pdf_session: {
          documentId: "doc-1",
          originalObjectKey: "documents/doc-1.pdf",
          pages: [],
          objects: [],
          operations: [],
        },
      },
      blocks: [],
      page_dimensions: [],
      styles: {},
    } as any;

    const { result } = renderHook(() => useNativePdfSession("doc-1", model));
    expect(result.current.session?.originalObjectKey).toBe("documents/doc-1.pdf");
  });

  it("returns null session for model without native session", () => {
    const model = { id: "doc-1", meta: { title: "Doc" }, blocks: [], page_dimensions: [], styles: {} } as any;
    const { result } = renderHook(() => useNativePdfSession("doc-1", model));
    expect(result.current.session).toBeNull();
  });

  it("persists operations on append", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) });

    const model = {
      id: "doc-1",
      meta: {
        native_pdf_session: {
          documentId: "doc-1",
          originalObjectKey: "documents/doc-1.pdf",
          pages: [{ pageIndex: 0, width: 612, height: 792 }],
          objects: [{ id: "obj-1", pageIndex: 0, type: "text", bbox: [0, 0, 10, 10], text: "Hi" }],
          operations: [],
        },
      },
      blocks: [],
      page_dimensions: [],
      styles: {},
    } as any;

    const { result } = renderHook(() => useNativePdfSession("doc-1", model));

    await act(async () => {
      await result.current.appendOperation({
        id: "op-1",
        type: "replace_text",
        pageIndex: 0,
        targetObjectId: "obj-1",
        before: { text: "Hi" },
        after: { text: "Hello" },
        createdAt: "now",
      });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/bff/documents/doc-1/operations",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(result.current.session?.operations).toHaveLength(1);
  });
});
