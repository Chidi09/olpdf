"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DocumentModel } from "@olpdf/document-model";

type Resolver = {
  resolve: (model: DocumentModel) => void;
  reject: (err: Error) => void;
};

/**
 * Spawns a Web Worker that runs the Rust/Wasm PDF parser.
 * Call parsePdf(arrayBuffer) to get an instant DocumentModel (confidence 0.8).
 * The server-side PyMuPDF pass then enriches it to confidence 1.0.
 *
 * Usage:
 *   const { parsePdf } = usePdfWasm();
 *   const preview = await parsePdf(file.arrayBuffer());
 */
export function usePdfWasm() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef<Map<string, Resolver>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const worker = new Worker(
      new URL("../workers/pdfWasm.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<{ id: string; result?: DocumentModel; error?: string }>) => {
      const { id, result, error } = e.data;
      const p = pending.current.get(id);
      if (!p) return;
      pending.current.delete(id);
      error ? p.reject(new Error(error)) : p.resolve(result!);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const parsePdf = useCallback((arrayBuffer: ArrayBuffer): Promise<DocumentModel> => {
    return new Promise<DocumentModel>((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("PDF WASM worker not ready"));
        return;
      }
      const id = crypto.randomUUID();
      pending.current.set(id, { resolve, reject });
      // Transfer ownership of the buffer to the worker (zero-copy)
      workerRef.current.postMessage({ id, buffer: arrayBuffer }, [arrayBuffer]);
    });
  }, []);

  return { parsePdf };
}
