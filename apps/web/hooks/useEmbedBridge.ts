"use client";

import { useEffect, useCallback } from "react";
import type { DocumentModel } from "@olpdf/document-model";

interface UseEmbedBridgeArgs {
  parentOrigin: string;
  onSetReadOnly?: (readOnly: boolean) => void;
  onSetTheme?: (theme: "light" | "dark") => void;
  onTriggerExport?: (format: "pdf" | "docx") => void;
  onGetDocument?: () => DocumentModel | null;
  onLoad?: (buffer: ArrayBuffer) => void;
}

function postToParent(
  envelope: { olpdf: 1; id: string; type: string; payload: unknown; replyTo?: string },
  parentOrigin: string,
) {
  if (typeof window === "undefined") return;
  window.parent.postMessage(envelope, parentOrigin);
}

function getNewId(): string {
  return crypto.randomUUID();
}

export function useEmbedBridge({
  parentOrigin,
  onSetReadOnly,
  onSetTheme,
  onTriggerExport,
  onGetDocument,
  onLoad,
}: UseEmbedBridgeArgs) {
  if (parentOrigin === "*") throw new Error("parentOrigin cannot be *");

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== parentOrigin) return;

      const data = e.data as Record<string, unknown>;
      if (!data || data.olpdf !== 1) return;

      const type = String(data.type ?? "");
      const payload = data.payload as Record<string, unknown> ?? {};
      const replyTo = String(data.id ?? "");

      function reply(result: "reply:ok" | "reply:error", replyPayload: unknown) {
        postToParent({ olpdf: 1, id: getNewId(), type: result, payload: replyPayload, replyTo }, parentOrigin);
      }

      switch (type) {
        case "command:setReadOnly":
          onSetReadOnly?.(Boolean(payload.readOnly));
          break;
        case "command:setTheme":
          onSetTheme?.(payload.theme as "light" | "dark");
          break;
        case "command:triggerExport":
          onTriggerExport?.(payload.format as "pdf" | "docx");
          break;
        case "command:getDocument": {
          const doc = onGetDocument?.();
          reply("reply:ok", { documentModel: doc ?? null });
          break;
        }
        case "command:loadDocument":
          if (payload.buffer) {
            onLoad?.(payload.buffer as ArrayBuffer);
          }
          break;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [parentOrigin, onSetReadOnly, onSetTheme, onTriggerExport, onGetDocument, onLoad]);

  // Signal ready to the host page
  useEffect(() => {
    postToParent({ olpdf: 1, id: getNewId(), type: "event:ready", payload: {} }, parentOrigin);
  }, [parentOrigin]);

  const emitModelUpdate = useCallback(
    (documentId: string, model: DocumentModel) => {
      postToParent({ olpdf: 1, id: getNewId(), type: "event:modelUpdate", payload: { documentId, documentModel: model } }, parentOrigin);
    },
    [parentOrigin],
  );

  const emitPageAdded = useCallback(
    (pageIndex: number, width: number, height: number) => {
      postToParent({ olpdf: 1, id: getNewId(), type: "event:pageAdded", payload: { pageIndex, width, height } }, parentOrigin);
    },
    [parentOrigin],
  );

  const emitPageRemoved = useCallback(
    (pageIndex: number) => {
      postToParent({ olpdf: 1, id: getNewId(), type: "event:pageRemoved", payload: { pageIndex } }, parentOrigin);
    },
    [parentOrigin],
  );

  const emitSave = useCallback(
    (documentId: string, model: DocumentModel) => {
      postToParent({
        olpdf: 1,
        id: getNewId(),
        type: "event:save",
        payload: { documentId, blockCount: model.blocks?.length ?? 0, pageCount: model.page_dimensions?.length ?? 1 },
      }, parentOrigin);
    },
    [parentOrigin],
  );

  const emitExportComplete = useCallback(
    (url: string) => {
      postToParent({ olpdf: 1, id: getNewId(), type: "event:exportComplete", payload: { url } }, parentOrigin);
    },
    [parentOrigin],
  );

  return { emitModelUpdate, emitPageAdded, emitPageRemoved, emitSave, emitExportComplete };
}
