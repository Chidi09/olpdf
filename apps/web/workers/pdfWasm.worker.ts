// Web Worker: loads the Rust/Wasm PDF parser off the main thread.
// The binary and JS bindings are served from /wasm/ (apps/web/public/wasm/).
// Build: cd apps/pdf-wasm && ./build.sh
// `export {}` makes this a module so `declare const self` is a local override,
// not a redeclaration of the global WorkerGlobalScope.self.
export {};
declare const self: {
  location: { origin: string };
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(data: unknown): void;
};

type ParseFn = (data: Uint8Array) => unknown;
type StreamingParseFn = (data: Uint8Array, pageIndex: number) => unknown;
type StreamingPreflightFn = (data: Uint8Array) => unknown;

let parseFn: ParseFn | null = null;
let preflightFn: ((data: Uint8Array) => unknown) | null = null;
let parsePageByIndexFn: StreamingParseFn | null = null;
let preflightStreamingFn: StreamingPreflightFn | null = null;

const ready = (async () => {
  // @ts-expect-error — dynamic wasm import has no type declarations
  const mod = await import(/* webpackIgnore: true */ "/wasm/pdf_wasm.js");
  await (mod.default as (url: URL | string) => Promise<void>)(
    new URL("/wasm/pdf_wasm_bg.wasm", self.location.origin)
  );
  parseFn = mod.parse_pdf as ParseFn;
  preflightFn = mod.preflight_pdf as ParseFn;
  parsePageByIndexFn = mod.parse_page_by_index as StreamingParseFn;
  preflightStreamingFn = mod.preflight_streaming as StreamingPreflightFn;
  self.postMessage({ type: "init_ok" });
})().catch((e) => {
  console.error("[pdf-wasm worker] init failed:", e);
  self.postMessage({ type: "init_error", error: String(e) });
});

self.onmessage = async (e: MessageEvent<{ id: string; buffer: ArrayBuffer; type?: string; pageIndex?: number }>) => {
  await ready;
  const { id, buffer, type, pageIndex } = e.data;

  if (type === "preflight") {
    try {
      if (!preflightFn) throw new Error("Wasm preflight not initialized");
      const result = preflightFn(new Uint8Array(buffer));
      self.postMessage({ id, result: { source: "rust-wasm", ...(result as Record<string, unknown>) } });
    } catch (err) {
      self.postMessage({ id, error: String(err) });
    }
    return;
  }

  if (type === "preflight_streaming") {
    try {
      if (!preflightStreamingFn) throw new Error("Wasm streaming preflight not initialized");
      const result = preflightStreamingFn(new Uint8Array(buffer));
      self.postMessage({ id, result: { source: "rust-wasm", ...(result as Record<string, unknown>) } });
    } catch (err) {
      self.postMessage({ id, error: String(err) });
    }
    return;
  }

  if (type === "parse_streaming") {
    try {
      if (!parsePageByIndexFn) throw new Error("Wasm streaming parse not initialized");
      const result = parsePageByIndexFn(new Uint8Array(buffer), pageIndex ?? 0);
      self.postMessage({ id, pageIndex, result: { source: "rust-wasm", blocks: result as Record<string, unknown>[] } });
    } catch (err) {
      self.postMessage({ id, pageIndex, error: String(err) });
    }
    return;
  }

  try {
    if (!parseFn) throw new Error("Wasm not initialized");
    const result = parseFn(new Uint8Array(buffer));
    self.postMessage({ id, result: { source: "rust-wasm", ...(result as Record<string, unknown>) } });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
