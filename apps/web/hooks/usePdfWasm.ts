"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Resolver = {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
};

/**
 * Spawns a Web Worker that runs the Rust/Wasm PDF parser.
 * Call parsePdf(arrayBuffer) to get the raw wasm parse result.
 * Use normalizeWasmResult() to convert it into a PdfEditSession.
 *
 * Usage:
 *   const { parsePdf, ready } = usePdfWasm();
 *   const raw = await parsePdf(file.arrayBuffer());
 */
export function usePdfWasm() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef<Map<string, Resolver>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const worker = new Worker(
      new URL("../workers/pdfWasm.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    setReady(true);

    worker.onmessage = (e: MessageEvent<{ id: string; result?: unknown; error?: string }>) => {
      const { id, result, error } = e.data;
      const p = pending.current.get(id);
      if (!p) return;
      pending.current.delete(id);
      error ? p.reject(new Error(error)) : p.resolve(result);
    };

    worker.onerror = (err) => {
      for (const [id, p] of pending.current) {
        p.reject(new Error(`Worker error: ${err.message}`));
      }
      pending.current.clear();
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      setReady(false);
    };
  }, []);

  const send = useCallback((arrayBuffer: ArrayBuffer, type?: string): Promise<unknown> => {
    return new Promise<unknown>((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("PDF WASM worker not ready"));
        return;
      }
      const id = crypto.randomUUID();
      pending.current.set(id, { resolve, reject });
      const msg: Record<string, unknown> = { id, buffer: arrayBuffer };
      if (type) msg.type = type;
      workerRef.current.postMessage(msg, [arrayBuffer]);
    });
  }, []);

  const parsePdf = useCallback((arrayBuffer: ArrayBuffer): Promise<unknown> => {
    return send(arrayBuffer);
  }, [send]);

  const preflightPdf = useCallback((arrayBuffer: ArrayBuffer): Promise<{ page_count: number; page_dimensions: Array<{ page_index: number; width: number; height: number }> }> => {
    return send(arrayBuffer, "preflight") as Promise<{ page_count: number; page_dimensions: Array<{ page_index: number; width: number; height: number }> }>;
  }, [send]);

  return { parsePdf, preflightPdf, ready };
}
