export type PdfNativeObjectType = "text" | "image" | "path" | "shape" | "annotation" | "form_field";

/** 4-element tuple: [left, top, width, height] in PDF coordinate space */
export type PdfRect = [number, number, number, number];

export type WasmRichSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  font_family?: string;
  font_size?: number;
  color?: string;
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

export type PdfEditSession = {
  documentId: string;
  originalObjectKey: string;
  pages: Array<{ pageIndex: number; width: number; height: number; previewUrl?: string }>;
  objects: PdfNativeObject[];
  operations: PdfEditOperation[];
};
