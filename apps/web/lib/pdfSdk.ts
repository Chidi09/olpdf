// Phase 7: TypeScript SDK wrapper around the WASM PdfDocument.

type PdfObjectJson =
  | { type: "null" }
  | { type: "bool"; value: boolean }
  | { type: "integer"; value: number }
  | { type: "real"; value: number }
  | { type: "name"; value: string }
  | { type: "string"; value: string }
  | { type: "array"; items: PdfObjectJson[] }
  | { type: "dict"; entries: Record<string, PdfObjectJson> }
  | { type: "stream"; stream: { dict: Record<string, PdfObjectJson>; decoded: string } }
  | { type: "ref"; obj: number; gen: number };

type PdfAnnotation = Record<string, PdfObjectJson>;
type PdfFormField = Record<string, PdfObjectJson>;
type PdfImage = { name: string; width?: number; height?: number; data: string };
type PdfMetadata = Record<string, PdfObjectJson>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WasmModule = { PdfDocument: new (data: Uint8Array) => any };

let wasmModule: WasmModule | undefined;

async function getWasm(): Promise<WasmModule> {
  if (!wasmModule) {
    // @ts-expect-error — dynamic wasm import has no type declarations
    const mod = await import(/* webpackIgnore: true */ "/wasm/pdf_wasm.js");
    wasmModule = mod as WasmModule;
  }
  return wasmModule;
}

export class PdfDocument {
  private handle: any;

  private constructor(handle: any) {
    this.handle = handle;
  }

  static async load(bytes: ArrayBuffer): Promise<PdfDocument> {
    const wasm = await getWasm();
    const handle = new wasm.PdfDocument(new Uint8Array(bytes));
    return new PdfDocument(handle);
  }

  pageCount(): number {
    return this.handle.page_count();
  }

  pageSize(pageNum: number): { width: number; height: number } {
    return this.handle.page_size(pageNum) as { width: number; height: number };
  }

  getObject(objNum: number, genNum: number = 0): PdfObjectJson {
    return this.handle.get_object(objNum, genNum) as PdfObjectJson;
  }

  setObject(objNum: number, genNum: number, value: PdfObjectJson): void {
    this.handle.set_object(objNum, genNum, value);
  }

  addObject(value: PdfObjectJson): number {
    return this.handle.add_object(value) as number;
  }

  // Phase 3: Annotations
  getAnnotations(pageNum: number): PdfAnnotation[] {
    return this.handle.get_annotations(pageNum) as PdfAnnotation[];
  }

  addAnnotation(pageNum: number, annotation: PdfAnnotation): number {
    return this.handle.add_annotation(pageNum, annotation) as number;
  }

  removeAnnotation(pageNum: number, annotObjNum: number): void {
    this.handle.remove_annotation(pageNum, annotObjNum);
  }

  // Phase 3: Metadata
  getMetadata(): PdfMetadata {
    return this.handle.get_metadata() as PdfMetadata;
  }

  setMetadata(meta: PdfMetadata): void {
    this.handle.set_metadata(meta);
  }

  // Phase 4: Form fields
  getFormFields(): PdfFormField[] {
    return this.handle.get_form_fields() as PdfFormField[];
  }

  setFieldValue(fieldObjNum: number, value: string): void {
    this.handle.set_field_value(fieldObjNum, value);
  }

  flattenForm(): void {
    this.handle.flatten_form();
  }

  // Phase 5: Page operations
  deletePage(pageNum: number): void {
    this.handle.delete_page(pageNum);
  }

  insertBlankPage(afterPage: number, width: number, height: number): void {
    this.handle.insert_blank_page(afterPage, width, height);
  }

  reorderPages(newOrder: number[]): void {
    this.handle.reorder_pages(new Uint32Array(newOrder));
  }

  rotatePage(pageNum: number, degrees: 0 | 90 | 180 | 270): void {
    this.handle.rotate_page(pageNum, degrees);
  }

  getImages(pageNum: number): PdfImage[] {
    return this.handle.get_images(pageNum) as PdfImage[];
  }

  // Phase 6: Output
  serialize(): Uint8Array {
    return this.handle.serialize() as Uint8Array;
  }

  serializeIncremental(original: ArrayBuffer): Uint8Array {
    return this.handle.serialize_incremental(new Uint8Array(original)) as Uint8Array;
  }

  static async preflightStreaming(bytes: ArrayBuffer): Promise<{ totalPages: number; chunkSize: number }> {
    const wasm = await getWasm();
    return wasm.preflight_streaming(new Uint8Array(bytes)) as { totalPages: number; chunkSize: number };
  }
}
