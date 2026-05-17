export type PdfNativeObjectType = "text" | "image" | "path" | "shape" | "annotation" | "form_field" | "list_item";

/** 4-element tuple: [left, top, width, height] in PDF coordinate space */
export type PdfRect = [number, number, number, number];

export type WasmRichSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  font_family?: string;
  font_size?: number;
  color?: string;
  vertical_align?: "super" | "sub";
};

export type PdfNativeObject = {
  id: string;
  pageIndex: number;
  type: PdfNativeObjectType;
  bbox: PdfRect;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  zIndex?: number;
  sourceRef?: string;
  rich_spans?: WasmRichSpan[];
  is_invisible?: boolean;
  bullet?: string;
  alignment?: "left" | "center" | "right" | "justify";
};

export type ParseMetrics = {
  duration_ms: number;
  total_blocks: number;
  unmapped_chars: number;
  pages_failed: number;
  warnings: string[];
  image_count: number;
  missing_fonts_count: number;
  is_likely_scanned: boolean;
};

export type WasmGlyphPayload = {
  id: string;
  char: string;
  bbox: [number, number, number, number];
  font_family: string;
  font_size: number;
  color: string;
  page_index: number;
};

export type WasmParseResult = {
  blocks: PdfNativeObject[];
  glyphs?: WasmGlyphPayload[];
  page_dimensions: Array<{ page_index: number; width: number; height: number }>;
  metrics: ParseMetrics;
};

export type PdfEditOperationType = "replace_text" | "move_object" | "resize_object" | "delete_object" | "insert_text" | "insert_shape";

export type PdfEditOperation = {
  id: string;
  type: PdfEditOperationType;
  pageIndex: number;
  targetObjectId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdAt: string;
};

export type PdfEditSessionStatus = "parsing" | "ready" | "partial" | "failed";
export type PdfEditSessionSource = "wasm" | "server" | "hybrid";

export type WasmLayoutObject = {
  id: string;
  type: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  sourceRef: string;
  originalPdfObjectId: string;
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  textAlign?: string;
};

export type PdfAllowedOperation = "replace_text" | "format_text" | "move" | "resize" | "replace_image" | "overlay_text" | "ocr" | "delete";

export type PdfEditabilityMode = "flow_text" | "atomic_text" | "replaceable_image" | "atomic_vector" | "raster" | "unsupported";

export type PdfEditability = {
  mode: PdfEditabilityMode;
  confidence: number;
  reasons: string[];
  allowedOperations: PdfAllowedOperation[];
};

export type PdfSourceRef = {
  pageIndex: number;
  objectRef?: string;
  streamRef?: string;
  operatorIndex?: number;
  byteRange?: [number, number];
};

export type PdfGlyph = {
  id: string;
  char: string;
  glyphId?: number;
  bbox: PdfRect;
  baseline: number;
  fontRef?: string;
  fontFamily?: string;
  fontSize: number;
  color?: string;
  sourceRef: PdfSourceRef;
};

export type PdfTextRun = {
  id: string;
  text: string;
  bbox: PdfRect;
  baseline: number;
  fontFamily?: string;
  fontSize: number;
  color?: string;
  glyphs: PdfGlyph[];
  sourceRefs: PdfSourceRef[];
};

export type PdfTextLine = {
  id: string;
  bbox: PdfRect;
  baseline: number;
  runs: PdfTextRun[];
};

export type PdfStructuredBlock = {
  id: string;
  kind: "flow_text" | "atomic_text" | "image" | "vector" | "raster" | "unsupported";
  pageIndex: number;
  bbox: PdfRect;
  confidence: number;
  editability: PdfEditability;
  lines?: PdfTextLine[];
  sourceRefs: PdfSourceRef[];
};

export type PdfStructuredPage = {
  pageIndex: number;
  width: number;
  height: number;
  blocks: PdfStructuredBlock[];
};

export type PdfDocumentOperation = {
  id: string;
  type: string;
  blockId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdAt: string;
};

export type PdfDocumentTree = {
  documentId: string;
  pages: PdfStructuredPage[];
  operations: PdfDocumentOperation[];
};

export type PdfEditSession = {
  documentId: string;
  originalObjectKey: string;
  pages: Array<{ pageIndex: number; width: number; height: number; previewUrl?: string }>;
  objects: PdfNativeObject[];
  layoutObjects?: WasmLayoutObject[];
  operations: PdfEditOperation[];
  status?: PdfEditSessionStatus;
  source?: PdfEditSessionSource;
  parseMetrics?: ParseMetrics;
  lastSyncedAt?: string;
};
