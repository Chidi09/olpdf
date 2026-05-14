import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDocumentExport } from "./useDocumentExport";

describe("useDocumentExport", () => {
  const mockModel = {
    id: "doc-1",
    meta: { title: "Test", layout_mode: "fidelity" },
    blocks: [],
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in idle phase", () => {
    const { result } = renderHook(() =>
      useDocumentExport({
        documentId: "doc-1",
        getModel: () => mockModel as any,
        flushSave: async () => {},
      }),
    );
    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.isExporting).toBe(false);
  });

  it("returns exportNow and retry functions", () => {
    const { result } = renderHook(() =>
      useDocumentExport({
        documentId: "doc-1",
        getModel: () => null,
        flushSave: async () => {},
      }),
    );
    expect(typeof result.current.exportNow).toBe("function");
    expect(typeof result.current.retry).toBe("function");
  });

  it("calls flushSave then POSTs on exportNow", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://example.com/doc.pdf" }),
    });

    const flushSave = vi.fn(async () => {});
    const { result } = renderHook(() =>
      useDocumentExport({
        documentId: "doc-1",
        getModel: () => mockModel as any,
        flushSave,
      }),
    );

    await act(async () => {
      await result.current.exportNow();
    });

    expect(flushSave).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/bff/documents/doc-1/export/fidelity",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sets error when export fails with backend detail", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Font rendering error" }),
    });

    const { result } = renderHook(() =>
      useDocumentExport({
        documentId: "doc-1",
        getModel: () => mockModel as any,
        flushSave: async () => {},
      }),
    );

    await act(async () => {
      await result.current.exportNow();
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.error).toBe("Font rendering error");
  });

  it("retry re-uses the same format", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, json: async () => ({ detail: "fail" }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ url: "https://example.com/doc.pdf" }) });
    });

    const { result } = renderHook(() =>
      useDocumentExport({
        documentId: "doc-1",
        getModel: () => mockModel as any,
        flushSave: async () => {},
      }),
    );

    await act(async () => { await result.current.exportNow(); });
    expect(result.current.phase).toBe("error");

    await act(async () => { await result.current.retry(); });
    expect(callCount).toBe(2);
  });
});
