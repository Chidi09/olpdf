import type { PdfEditSession } from "@/types/nativePdf";

export function buildNativeImportPayload(args: { documentId: string; fileBytes: string; session?: PdfEditSession }) {
  return {
    documentId: args.documentId,
    fileBytes: args.fileBytes,
    layout_mode: "fidelity",
    client_model: args.session
      ? {
          meta: {
            title: "Imported PDF",
            native_pdf: true,
            original_pdf_key: args.session.originalObjectKey,
            native_pdf_session: args.session,
            layout_mode: "fidelity",
          },
          blocks: args.session.objects.map((object) => ({
            id: object.id,
            type: object.type === "text" || object.type === "list_item" ? "paragraph" : object.type,
            content: object.text ?? "",
            page_index: object.pageIndex,
            bounding_box: object.bbox,
            font_meta: object.fontFamily ? { family: object.fontFamily, size: object.fontSize, color: object.color } : undefined,
            z_index: object.zIndex ?? 0,
            alignment: object.alignment,
          })),
          page_dimensions: args.session.pages.map((p) => ({ page_index: p.pageIndex, width: p.width, height: p.height })),
          styles: {},
        }
      : undefined,
  };
}
