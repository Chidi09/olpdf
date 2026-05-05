"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentModel } from "@olpdf/document-model";
import { bffGet, bffPost } from "@/lib/bffClient";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    },
  });
}
