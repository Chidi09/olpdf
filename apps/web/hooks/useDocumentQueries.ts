"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentModel } from "@olpdf/document-model";
import { BffHttpError, bffGet, bffPost } from "@/lib/bffClient";

type DocumentPayload = {
  id: string;
  document_model: DocumentModel;
};

type PreviewPayload = {
  id: string;
  preview_url: string;
};

export function useDocumentQuery(documentId: string) {
  return useQuery({
    queryKey: ["document", documentId],
    queryFn: () => bffGet<DocumentPayload>(`/api/bff/documents/${documentId}`),
    enabled: Boolean(documentId),
  });
}

export function useDocumentPreviewQuery(documentId: string) {
  return useQuery({
    queryKey: ["document-preview", documentId],
    queryFn: () => bffGet<PreviewPayload>(`/api/bff/documents/${documentId}/preview`),
    enabled: Boolean(documentId),
    staleTime: 15_000,
  });
}

export function useSaveDocumentMutation(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (document_model: DocumentModel) =>
      bffPost(`/api/bff/documents/${documentId}/save`, { document_model }),
    onError: (error, variables) => {
      if (error instanceof BffHttpError && error.status === 401) {
        if (typeof window !== "undefined") {
          // Draft recovery: Save current state to local storage
          try {
            const recoveryKey = `olpdf_recovery_${documentId}`;
            localStorage.setItem(recoveryKey, JSON.stringify({
              model: variables,
              timestamp: new Date().toISOString()
            }));
          } catch (e) {
            console.error("Failed to save recovery draft", e);
          }
          
          // Redirect to login with recovery flag
          window.location.href = `/login?redirect=/editor/${documentId}&recovered=1`;
        }
      }
    },
    onSuccess: () => {
      // Clear recovery draft on success
      if (typeof window !== "undefined") {
        localStorage.removeItem(`olpdf_recovery_${documentId}`);
      }
      queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    },
  });
}
