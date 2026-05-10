"use client";

import { useEffect, useCallback } from "react";
import type { DocumentModel } from "@olpdf/document-model";

type EmbedCommand =
  | { type: "LOAD"; data: { buffer: ArrayBuffer } }
  | { type: "SET_THEME"; data: { theme: "light" | "dark" } }
  | { type: "DOWNLOAD" };

interface UseEmbedBridgeArgs {
  parentOrigin: string;
  onLoad?: (buffer: ArrayBuffer) => void;
  onSetTheme?: (theme: "light" | "dark") => void;
  onDownload?: () => void;
}

function postToParent(type: string, data: unknown, parentOrigin: string) {
  if (typeof window === "undefined") return;
  window.parent.postMessage({ type, data }, parentOrigin);
}

export function useEmbedBridge({
  parentOrigin,
  onLoad,
  onSetTheme,
  onDownload,
}: UseEmbedBridgeArgs) {
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (parentOrigin !== "*" && e.origin !== parentOrigin) return;
      const cmd = e.data as EmbedCommand;
      switch (cmd.type) {
        case "LOAD":
          onLoad?.(cmd.data.buffer);
          break;
        case "SET_THEME":
          onSetTheme?.(cmd.data.theme);
          break;
        case "DOWNLOAD":
          onDownload?.();
          break;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [parentOrigin, onLoad, onSetTheme, onDownload]);

  // Signal ready to the host page
  useEffect(() => {
    postToParent("READY", undefined, parentOrigin);
  }, [parentOrigin]);

  const emitBlockChange = useCallback(
    (blockId: string, content: string) => {
      postToParent("BLOCK_CHANGE", { blockId, content }, parentOrigin);
    },
    [parentOrigin],
  );

  const emitSave = useCallback(
    (documentId: string, model: DocumentModel) => {
      postToParent("SAVE", { documentId, blockCount: model.blocks?.length ?? 0 }, parentOrigin);
    },
    [parentOrigin],
  );

  const emitExportComplete = useCallback(
    (url: string) => {
      postToParent("EXPORT_COMPLETE", { url }, parentOrigin);
    },
    [parentOrigin],
  );

  return { emitBlockChange, emitSave, emitExportComplete };
}
