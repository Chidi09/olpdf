import { useCallback, useRef, useState } from "react";
import type { DocumentModel } from "@olpdf/document-model";
import { toExportErrorMessage, type ExportPhase, type ExportTelemetryPayload } from "./types";
import { sanitizeDocumentModelForApi } from "@/lib/documentModelSanitizer";
import type { PdfEditSession } from "@/types/nativePdf";
import { pageLayoutFromDocumentModel } from "@/lib/pageLayout/fromNativePdf";
import { buildLayoutExportPayload } from "@/lib/pageLayout/exportPayload";
import { operationsFromLayoutDiff, validateLayoutOperations } from "@/lib/pageLayout/operations";
import { usePageLayoutStore } from "@/store/usePageLayoutStore";

export interface UseDocumentExportOptions {
  documentId: string;
  getModel: () => DocumentModel | null;
  flushSave: () => Promise<void>;
  defaultFormat?: string;
  onTelemetry?: (payload: ExportTelemetryPayload) => void;
}

export function useDocumentExport(options: UseDocumentExportOptions) {
  const { documentId, getModel, flushSave, defaultFormat = "fidelity", onTelemetry } = options;
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastFormatRef = useRef<string>(defaultFormat);
  const startMsRef = useRef<number>(0);

  const doExport = useCallback(async (format: string) => {
    const model = getModel();
    if (!model) return;
    if (phase === "exporting" || phase === "saving") return;

    startMsRef.current = Date.now();
    lastFormatRef.current = format;
    setError(null);

    const layoutMode = model.meta?.layout_mode ?? "fidelity";

    try {
      setPhase("saving");
      await flushSave();

      setPhase("exporting");
      const nativeSession = (model.meta as Record<string, unknown> | undefined)?.native_pdf_session as PdfEditSession | undefined;
      const isNativePdf = (model.meta as Record<string, unknown> | undefined)?.native_pdf === true;

      let layoutPayload: Record<string, unknown> | undefined;
      const layoutStoreDoc = usePageLayoutStore.getState().document;
      if (isNativePdf) {
        const layoutDoc = layoutStoreDoc ?? pageLayoutFromDocumentModel(model as any);
        const payloadObj = buildLayoutExportPayload(layoutDoc) as unknown as Record<string, unknown>;
        const ops = layoutStoreDoc
          ? operationsFromLayoutDiff(null, layoutStoreDoc)
          : (nativeSession?.operations ?? []);
        const validationErrors = validateLayoutOperations(ops, layoutDoc);
        if (validationErrors.length > 0) {
          setError(`Validation failed: ${validationErrors.join("; ")}`);
          setPhase("error");
          return;
        }
        layoutPayload = { ...payloadObj, operations: ops };
      }

      const response = await fetch(`/api/bff/documents/${documentId}/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_model: sanitizeDocumentModelForApi(model as unknown as Record<string, unknown>),
          font_metrics: {},
          operations: nativeSession?.operations ?? [],
          original_object_key: nativeSession?.originalObjectKey ?? (model.meta as Record<string, unknown> | undefined)?.original_pdf_key,
          ...(layoutPayload ? { layout_payload: layoutPayload } : {}),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.url) {
        const msg = toExportErrorMessage(data);
        onTelemetry?.({
          documentId,
          layoutMode,
          format,
          elapsedMs: Date.now() - startMsRef.current,
          phase: "error",
          errorClass: response.status >= 500 ? "server_error" : "client_error",
        });
        setError(msg);
        setPhase("error");
        return;
      }

      const a = document.createElement("a");
      a.href = data.url;
      a.download = `${model.meta?.title || "document"}.${format === "fidelity" || format === "pdfa" || format === "tagged" ? "pdf" : format}`;
      a.click();

      onTelemetry?.({
        documentId,
        layoutMode,
        format,
        elapsedMs: Date.now() - startMsRef.current,
        phase: "success",
      });
      setPhase("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed. Please try again.";
      onTelemetry?.({
        documentId,
        layoutMode,
        format,
        elapsedMs: Date.now() - startMsRef.current,
        phase: "error",
        errorClass: "network_error",
      });
      setError(msg);
      setPhase("error");
    }
  }, [documentId, getModel, flushSave, onTelemetry, phase]);

  const exportNow = useCallback((format?: string) => {
    return doExport(format ?? defaultFormat);
  }, [doExport, defaultFormat]);

  const retry = useCallback(() => {
    return doExport(lastFormatRef.current);
  }, [doExport]);

  return {
    phase,
    error,
    isExporting: phase === "saving" || phase === "exporting",
    exportNow,
    retry,
  };
}
