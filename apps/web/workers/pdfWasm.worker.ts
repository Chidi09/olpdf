// Web Worker: loads the Rust/Wasm PDF parser off the main thread.
// The binary and JS bindings are served from /wasm/ (apps/web/public/wasm/).
// Build: cd apps/pdf-wasm && ./build.sh
// `export {}` makes this a module so `declare const self` is a local override,
// not a redeclaration of the global WorkerGlobalScope.self.
export {};
declare const self: { location: { origin: string }; onmessage: ((e: MessageEvent) => void) | null };

type ParseFn = (data: Uint8Array) => unknown;

let parseFn: ParseFn | null = null;

const ready = (async () => {
  // @ts-expect-error — dynamic wasm import has no type declarations
  const mod = await import(/* webpackIgnore: true */ "/wasm/pdf_wasm.js");
  await (mod.default as (url: URL | string) => Promise<void>)(
    new URL("/wasm/pdf_wasm_bg.wasm", self.location.origin)
  );
  parseFn = mod.parse_pdf as ParseFn;
})().catch((e) => {
  console.error("[pdf-wasm worker] init failed:", e);
});

self.onmessage = async (e: MessageEvent<{ id: string; buffer: ArrayBuffer }>) => {
  await ready;
  const { id, buffer } = e.data;
  try {
    if (!parseFn) throw new Error("Wasm not initialized");
    const result = parseFn(new Uint8Array(buffer));
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
