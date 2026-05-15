export type PageLayoutDocumentSource = {
  kind: "imported_pdf" | "writer_doc" | "book_chapter";
  originalPdfKey?: string;
};

export type StyleRegistry = Record<string, unknown>;
export type FontRegistry = Record<string, unknown>;
export type AssetRegistry = Record<string, unknown>;

export type RevisionSummary = {
  id: string;
  createdAt: string;
  label?: string;
};

export type PageDecoration = {
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  position: "left" | "center" | "right";
  excludeFirstPage?: boolean;
};

export type PageNumberDecoration = {
  position: "top_left" | "top_center" | "top_right" | "bottom_left" | "bottom_center" | "bottom_right";
  format: "page_n" | "page_n_of_m" | "n" | "-n-";
  startAt?: number;
  excludeFirstPage?: boolean;
};

export type PageDecorations = {
  header?: PageDecoration;
  footer?: PageDecoration;
  pageNumbers?: PageNumberDecoration;
};

export type PageLayoutDocument = {
  id: string;
  source: PageLayoutDocumentSource;
  pages: PageLayoutPage[];
  styles: StyleRegistry;
  fonts: FontRegistry;
  assets: AssetRegistry;
  revisions: RevisionSummary[];
  pageDecorations?: PageDecorations;
};

export type OriginalPdfPageBackground = {
  objectKey: string;
  pageIndex: number;
  width: number;
  height: number;
};

export type PageLayoutPage = {
  id: string;
  index: number;
  width: number;
  height: number;
  background?: OriginalPdfPageBackground;
  objects: LayoutObject[];
};

export type ObjectBase = {
  id: string;
  name?: string;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  originalPdfObjectId?: string;
};

export type TextFrame = ObjectBase & {
  type: "text";
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  underline: boolean;
  color: string;
  backgroundColor?: string;
  textAlign: "left" | "center" | "right" | "justify";
  lineHeight: number;
  letterSpacing: number;
  bullets: boolean;
  numbering: boolean;
};

export type ImageFrame = ObjectBase & {
  type: "image";
  src: string;
  objectKey?: string;
  crop?: { left: number; top: number; width: number; height: number };
};

export type TableFrame = ObjectBase & {
  type: "table";
  rows: number;
  cols: number;
  cells: string[][];
  cellBorders: boolean;
  headerRow: boolean;
};

export type ChartFrame = ObjectBase & {
  type: "chart";
  chartType: "bar" | "line" | "pie" | "donut";
  labels: string[];
  datasets: { label: string; values: number[]; color: string }[];
};

export type ShapeFrame = ObjectBase & {
  type: "shape";
  shapeType: "rect" | "rounded_rect" | "circle" | "ellipse" | "line" | "arrow" | "polygon" | "freehand";
  stroke: string;
  strokeWidth: number;
  fill: string;
};

export type SymbolFrame = ObjectBase & {
  type: "symbol";
  symbolId: string;
  color: string;
  size: number;
};

export type FormFieldFrame = ObjectBase & {
  type: "form_field";
  fieldType: "text" | "checkbox" | "radio" | "dropdown" | "date" | "signature";
  fieldName: string;
  value: string | boolean;
  required: boolean;
};

export type SignatureFrame = ObjectBase & {
  type: "signature";
  signatureData: string;
  drawnAt?: string;
};

export type AnnotationFrame = ObjectBase & {
  type: "annotation";
  annotationType: "highlight" | "underline" | "strikeout" | "sticky_note" | "comment" | "callout" | "stamp";
  content?: string;
  color: string;
};

export type LayoutObject = TextFrame | ImageFrame | TableFrame | ChartFrame | ShapeFrame | SymbolFrame | FormFieldFrame | SignatureFrame | AnnotationFrame;
