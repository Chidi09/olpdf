import type { DocumentModel } from "@olpdf/document-model";
import type { PdfEditSession } from "@/types/nativePdf";

export function attachNativeSession(model: DocumentModel, session: PdfEditSession): DocumentModel {
  return {
    ...model,
    meta: {
      ...(model.meta ?? {} as Record<string, unknown>),
      native_pdf: true,
      original_pdf_key: session.originalObjectKey,
      native_pdf_session: session,
      layout_mode: (model.meta as Record<string, unknown> | undefined)?.layout_mode ?? "fidelity",
    },
    page_dimensions: session.pages.map((p) => ({ page_index: p.pageIndex, width: p.width, height: p.height })),
  } as unknown as DocumentModel;
}

export function getNativeSession(model: DocumentModel | null | undefined): PdfEditSession | null {
  if (!model) return null;
  const raw = ((model.meta ?? {}) as Record<string, unknown>).native_pdf_session;
  if (!raw || typeof raw !== "object") return null;
  return raw as PdfEditSession;
}
