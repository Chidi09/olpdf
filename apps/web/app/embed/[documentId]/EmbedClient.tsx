"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { DocumentModel } from "@olpdf/document-model";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useEmbedBridge } from "@/hooks/useEmbedBridge";

const FidelityCanvas = dynamic(() => import("@/components/editor/FidelityCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-neutral-900">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-600" />
    </div>
  ),
});

interface EmbedClientProps {
  documentId: string;
  token: string;
  parentOrigin: string;
}

type ThemeValue = "light" | "dark";

export default function EmbedClient({ documentId, token, parentOrigin }: EmbedClientProps) {
  const [model, setModel] = useState<DocumentModel | null>(null);
  const [theme, setTheme] = useState<ThemeValue>("light");
  const [readOnly, setReadOnly] = useState(false);
  const [exportRequest, setExportRequest] = useState<{ requestId: string; format: "pdf" | "docx" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modelRef = useRef<DocumentModel | null>(null);

  // Authenticate the embed session with the provided short-lived token.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .setSession({ access_token: token, refresh_token: "" })
      .then(({ error: authErr }) => {
        if (authErr) {
          setError("Authentication failed.");
          return;
        }
        return fetch(`/api/bff/documents/${documentId}`)
          .then((r) => {
            if (!r.ok) throw new Error(`Failed to load document (${r.status})`);
            return r.json() as Promise<{ document_model: DocumentModel }>;
          })
          .then(({ document_model }) => {
            setModel(document_model);
            modelRef.current = document_model;
          });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load document."));
  }, [documentId, token]);

  // Apply theme to the document root when changed via the bridge.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const handleLoad = useCallback((_buffer: ArrayBuffer) => {
    console.warn("[embed] LOAD command received but the document is already loaded by ID.");
  }, []);

  const handleSetTheme = useCallback((t: ThemeValue) => setTheme(t), []);

  const handleSetReadOnly = useCallback((ro: boolean) => setReadOnly(ro), []);

  const handleTriggerExport = useCallback((format: "pdf" | "docx") => {
    setExportRequest({ requestId: crypto.randomUUID(), format });
  }, []);

  const handleGetDocument = useCallback(() => {
    return modelRef.current;
  }, []);

  const handleExportComplete = useCallback((result: { requestId: string; url: string }) => {
    setExportRequest(null);
    emitExportComplete(result.url);
  }, [emitExportComplete]);

  const handleExportError = useCallback((_result: { requestId: string; message: string }) => {
    setExportRequest(null);
  }, []);

  const { emitModelUpdate, emitPageAdded, emitPageRemoved, emitSave } = useEmbedBridge({
    parentOrigin,
    onLoad: handleLoad,
    onSetTheme: handleSetTheme,
    onSetReadOnly: handleSetReadOnly,
    onTriggerExport: handleTriggerExport,
    onGetDocument: handleGetDocument,
  });

  const handleModelChange = useCallback(
    (updated: DocumentModel) => {
      modelRef.current = updated;
      setModel((prev) => {
        const prevPages = prev?.page_dimensions ?? [];
        const nextPages = updated.page_dimensions ?? [];
        if (nextPages.length > prevPages.length) {
          for (let i = prevPages.length; i < nextPages.length; i++) {
            const dim = nextPages[i];
            if (dim) emitPageAdded(dim.page_index, dim.width, dim.height);
          }
        } else if (nextPages.length < prevPages.length) {
          for (let i = nextPages.length; i < prevPages.length; i++) {
            const dim = prevPages[i];
            if (dim) emitPageRemoved(dim.page_index);
          }
        }
        return updated;
      });
      emitModelUpdate(documentId, updated);
      emitSave(documentId, updated);
    },
    [documentId, emitModelUpdate, emitPageAdded, emitPageRemoved, emitSave],
  );

  // Listen for export result from FidelityCanvas and emit to host
  useEffect(() => {
    const handler = (e: Event) => {
      const { url } = (e as CustomEvent<{ url: string }>).detail ?? {};
      if (url) emitExportComplete(url);
    };
    document.addEventListener("olpdf:embed:export-complete", handler);
    return () => document.removeEventListener("olpdf:embed:export-complete", handler);
  }, [emitExportComplete]);

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-neutral-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-600" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden">
      <FidelityCanvas
        documentId={documentId}
        model={model}
        readOnly={readOnly}
        exportRequest={exportRequest}
        onExportComplete={handleExportComplete}
        onExportError={handleExportError}
        onModelChange={handleModelChange}
      />
    </div>
  );
}
