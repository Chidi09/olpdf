export type PdfNativeObjectType = "text" | "image" | "path" | "shape" | "annotation" | "form_field";

export type PdfRect = [number, number, number, number];

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
};

export type PdfEditOperation = {
  id: string;
  type: "replace_text" | "move_object" | "resize_object" | "delete_object" | "insert_text" | "insert_shape";
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
