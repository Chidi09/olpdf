"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PdfEditOperation, PdfEditSession } from "@/types/nativePdf";
import { useNativePdfSessionStore } from "@/store/useNativePdfSessionStore";
import type { DocumentModel } from "@olpdf/document-model";
import { getNativeSession } from "@/lib/nativePdf/documentModelAdapter";

export function useNativePdfSession(documentId: string, model: DocumentModel | null) {
  const store = useNativePdfSessionStore();
  const prevDocIdRef = useRef<string | null>(null);

  // Initialize from model when it changes
  useEffect(() => {
    if (!model || documentId !== prevDocIdRef.current) {
      const nativeSession = getNativeSession(model);
      if (nativeSession) {
        store.setSession(nativeSession);
        prevDocIdRef.current = documentId;
      }
    }
  }, [model, documentId, store]);

  const appendOperation = useCallback(
    async (operation: PdfEditOperation) => {
      store.appendOperation(operation);
      // Persist operations to backend
      store.setSyncing(true);
      try {
        const currentSession = useNativePdfSessionStore.getState().session;
        if (currentSession) {
          const response = await fetch(`/api/bff/documents/${documentId}/operations`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operations: currentSession.operations }),
          });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            store.setLastError((data as { detail?: string }).detail ?? "Failed to persist operations");
          } else {
            store.setLastError(null);
          }
        }
      } catch (err) {
        store.setLastError(err instanceof Error ? err.message : "Network error");
      } finally {
        store.setSyncing(false);
      }
    },
    [documentId, store],
  );

  const flushOperations = useCallback(async () => {
    const currentSession = useNativePdfSessionStore.getState().session;
    if (!currentSession || currentSession.operations.length === 0) return;
    store.setSyncing(true);
    try {
      const response = await fetch(`/api/bff/documents/${documentId}/operations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations: currentSession.operations }),
      });
      if (!response.ok) throw new Error("Failed to flush operations");
      store.setLastError(null);
    } catch (err) {
      store.setLastError(err instanceof Error ? err.message : "Network error");
    } finally {
      store.setSyncing(false);
    }
  }, [documentId, store]);

  return {
    session: store.session,
    isSyncing: store.isSyncing,
    lastError: store.lastError,
    appendOperation,
    flushOperations,
  };
}
