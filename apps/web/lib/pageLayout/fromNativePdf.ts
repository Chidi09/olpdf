import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import type { PdfEditSession, WasmLayoutObject } from "@/types/nativePdf";
import type { PageLayoutDocument, PageLayoutPage, TextFrame, ImageFrame, ShapeFrame, LayoutObject } from "@/types/pageLayout";
import { getNativeSession } from "@/lib/nativePdf/documentModelAdapter";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

function nativeObjectToLayoutObject(obj: PdfEditSession["objects"][0]): LayoutObject {
  const bbox = obj.bbox;
  const base = {
    id: obj.id,
    visible: !obj.is_invisible,
    locked: false,
    zIndex: obj.zIndex ?? 0,
    opacity: 1,
    x: bbox[0],
    y: bbox[1],
    width: bbox[2],
    height: bbox[3],
    rotation: 0,
    originalPdfObjectId: obj.id,
  };

  if (obj.type === "text" || obj.type === "list_item") {
    return {
      ...base,
      type: "text" as const,
      content: obj.text ?? "",
      fontFamily: obj.fontFamily ?? "Inter",
      fontSize: obj.fontSize ?? 11,
      fontWeight: "normal" as const,
      fontStyle: "normal" as const,
      underline: false,
      color: obj.color ?? "#111111",
      textAlign: obj.alignment ?? "left",
      lineHeight: 1.25,
      letterSpacing: 0,
      bullets: false,
      numbering: false,
    } as TextFrame;
  }

  if (obj.type === "image") {
    return {
      ...base,
      type: "image" as const,
      src: "",
    };
  }

  if (obj.type === "shape") {
    return {
      ...base,
      type: "shape" as const,
      shapeType: "rect" as const,
      stroke: "#111111",
      strokeWidth: 1,
      fill: "transparent",
    };
  }

  if (obj.type === "annotation") {
    return {
      ...base,
      type: "annotation" as const,
      annotationType: "highlight" as const,
      color: "#ffeb3b",
    };
  }

  if (obj.type === "form_field") {
    return {
      ...base,
      type: "form_field" as const,
      fieldType: "text" as const,
      fieldName: obj.id,
      value: obj.text ?? "",
      required: false,
    };
  }

  return {
    ...base,
    type: "text" as const,
    content: obj.text ?? "",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "normal" as const,
    fontStyle: "normal" as const,
    underline: false,
    color: "#111111",
    textAlign: "left" as const,
    lineHeight: 1.25,
    letterSpacing: 0,
    bullets: false,
    numbering: false,
  } as TextFrame;
}

function nativeLayoutObjectToLayoutObject(obj: WasmLayoutObject): LayoutObject {
  const base = {
    id: obj.id,
    visible: true,
    locked: false,
    zIndex: obj.zIndex,
    opacity: 1,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation,
    originalPdfObjectId: obj.originalPdfObjectId,
  };

  if (obj.type === "text") {
    return {
      ...base,
      type: "text",
      content: obj.content ?? "",
      fontFamily: obj.fontFamily ?? "Inter",
      fontSize: obj.fontSize ?? 11,
      fontWeight: "normal",
      fontStyle: "normal",
      underline: false,
      color: obj.color ?? "#111111",
      textAlign: (obj.textAlign as "left" | "center" | "right" | "justify") ?? "left",
      lineHeight: 1.25,
      letterSpacing: 0,
      bullets: false,
      numbering: false,
    } as TextFrame;
  }

  if (obj.type === "image") {
    return {
      ...base,
      type: "image",
      src: "",
    } as ImageFrame;
  }

  if (obj.type === "shape") {
    return {
      ...base,
      type: "shape",
      shapeType: "rect",
      stroke: "#111111",
      strokeWidth: 1,
      fill: "transparent",
    } as ShapeFrame;
  }

  return {
    ...base,
    type: "text",
    content: obj.content ?? "",
    fontFamily: obj.fontFamily ?? "Inter",
    fontSize: obj.fontSize ?? 11,
    fontWeight: "normal",
    fontStyle: "normal",
    underline: false,
    color: obj.color ?? "#111111",
    textAlign: (obj.textAlign as "left" | "center" | "right" | "justify") ?? "left",
    lineHeight: 1.25,
    letterSpacing: 0,
    bullets: false,
    numbering: false,
  } as TextFrame;
}

function blockToLayoutObject(block: DocumentBlock): LayoutObject {
  const bbox = (block as Record<string, unknown>).bounding_box as number[] | undefined ?? [72, 72, 540, 86];
  return {
    id: block.id,
    type: "text",
    visible: !(block as Record<string, unknown>).is_invisible,
    locked: false,
    zIndex: 0,
    opacity: 1,
    x: bbox[0],
    y: bbox[1],
    width: Math.max(bbox[2] - bbox[0], 20),
    height: Math.max(bbox[3] - bbox[1], 20),
    rotation: 0,
    content: block.content ?? "",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "normal",
    fontStyle: "normal",
    underline: false,
    color: "#111111",
    textAlign: "left",
    lineHeight: 1.25,
    letterSpacing: 0,
    bullets: false,
    numbering: false,
  } as TextFrame;
}

export function pageLayoutFromDocumentModel(model: DocumentModel | null | undefined): PageLayoutDocument {
  const id = model?.id ?? "unknown";
  const meta = model?.meta as Record<string, unknown> | undefined;
  const isImported = Boolean(getNativeSession(model)) || meta?.native_pdf === true || typeof meta?.original_pdf_key === "string";
  const sourceKind: "imported_pdf" | "writer_doc" = isImported ? "imported_pdf" : "writer_doc";
  const originalPdfKey = (meta?.original_pdf_key as string) ?? undefined;

  const session = getNativeSession(model);

  const pages: PageLayoutPage[] = [];

  if (session && session.pages.length > 0) {
    for (const sp of session.pages) {
      const pageObjs = (session.layoutObjects ?? [])
        .filter((o) => o.pageIndex === sp.pageIndex);
      const page: PageLayoutPage = {
        id: `page-${sp.pageIndex}`,
        index: sp.pageIndex,
        width: sp.width,
        height: sp.height,
        objects: pageObjs.length > 0
          ? pageObjs.map(nativeLayoutObjectToLayoutObject)
          : session.objects.filter((o) => o.pageIndex === sp.pageIndex).map(nativeObjectToLayoutObject),
      };
      pages.push(page);
    }
  } else if (model?.page_dimensions && model.page_dimensions.length > 0) {
    for (const dim of model.page_dimensions) {
      const pageObjs = (model.blocks ?? [])
        .filter((b: DocumentBlock) => (b as Record<string, unknown>).page_index === dim.page_index)
        .map(blockToLayoutObject);
      const page: PageLayoutPage = {
        id: `page-${dim.page_index}`,
        index: dim.page_index,
        width: dim.width,
        height: dim.height,
        objects: pageObjs,
      };
      pages.push(page);
    }
  } else {
    pages.push({
      id: "page-0",
      index: 0,
      width: A4_WIDTH,
      height: A4_HEIGHT,
      objects: [],
    });
  }

  return {
    id,
    source: { kind: sourceKind, originalPdfKey },
    pages,
    styles: {},
    fonts: {},
    assets: {},
    revisions: [],
  };
}
