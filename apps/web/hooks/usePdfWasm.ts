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
  const [wasmError, setWasmError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const worker = new Worker(
      new URL("../workers/pdfWasm.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<{ id?: string; type?: string; result?: unknown; error?: string }>) => {
      const { id, type, result, error } = e.data;

      // Init lifecycle signals — not job responses
      if (type === "init_ok") { setReady(true); return; }
      if (type === "init_error") { setWasmError(error ?? "WASM failed to initialise"); return; }

      if (!id) return;
      const p = pending.current.get(id);
      if (!p) return;
      pending.current.delete(id);
      error ? p.reject(new Error(error)) : p.resolve(result);
    };

    worker.onerror = (err) => {
      setWasmError(`Worker error: ${err.message}`);
      for (const [, p] of pending.current) {
        p.reject(new Error(`Worker error: ${err.message}`));
      }
      pending.current.clear();
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      setReady(false);
      setWasmError(null);
    };
  }, []);

  const send = useCallback((arrayBuffer: ArrayBuffer, type?: string): Promise<unknown> => {
    const TIMEOUT_MS = 10_000;
    return new Promise<unknown>((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("PDF WASM worker not ready"));
        return;
      }
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.current.delete(id);
        reject(new Error("PDF WASM worker timed out after 10s"));
      }, TIMEOUT_MS);
      pending.current.set(id, {
        resolve: (r) => { clearTimeout(timer); resolve(r); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
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

  return { parsePdf, preflightPdf, ready, wasmError };
}
