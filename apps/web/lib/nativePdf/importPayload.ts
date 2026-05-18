import type { PdfEditSession } from "@/types/nativePdf";

export function buildNativeImportPayload(documentId: string, fileBytes: string, session: PdfEditSession) {
  return {
    documentId,
    fileBytes,
    layout_mode: "fidelity",
    client_model: {
      meta: {
        title: "Imported PDF",
        native_pdf: true,
        original_pdf_key: session.originalObjectKey,
        native_pdf_session: session,
        layout_mode: "fidelity",
      },
      blocks: session.objects.map((obj) => ({
        id: obj.id,
        type: "paragraph",
        content: obj.text || "",
        rich_spans: [],
        page_index: obj.pageIndex,
        bounding_box: obj.bbox,
        z_index: obj.zIndex,
        column_index: 0,
        alignment: "left",
        confidence_score: 1.0,
        needs_review: false,
        style_overrides: {},
        font_meta: obj.fontFamily
          ? { family: obj.fontFamily, size: obj.fontSize, color: obj.color, is_bold: false, is_italic: false }
          : undefined,
      })),
      page_dimensions: session.pages.map((p) => ({
        page_index: p.pageIndex,
        width: p.width,
        height: p.height,
      })),
      styles: {},
    },
  };
}
