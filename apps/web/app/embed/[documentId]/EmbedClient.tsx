"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [error, setError] = useState<string | null>(null);

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
          .then(({ document_model }) => setModel(document_model));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load document."));
  }, [documentId, token]);

  // Apply theme to the document root when changed via the bridge.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const handleLoad = useCallback((_buffer: ArrayBuffer) => {
    // Re-upload flow: POST the buffer to the ingest BFF and reload the model.
    // For now the embed is read-only for externally-loaded buffers — the host
    // should upload the file and obtain a documentId before constructing the embed.
    console.warn("[embed] LOAD command received but the document is already loaded by ID.");
  }, []);

  const handleSetTheme = useCallback((t: ThemeValue) => setTheme(t), []);

  const handleDownload = useCallback(() => {
    // Trigger the existing export flow by simulating a click on the hidden
    // export button rendered by FidelityCanvas. The export result URL is
    // emitted back via emitExportComplete once the export completes.
    document.dispatchEvent(new CustomEvent("olpdf:embed:download"));
  }, []);

  const { emitModelUpdate, emitPageAdded, emitPageRemoved, emitSave, emitExportComplete } = useEmbedBridge({
    parentOrigin,
    onLoad: handleLoad,
    onSetTheme: handleSetTheme,
    onDownload: handleDownload,
  });

  const handleModelChange = useCallback(
    (updated: DocumentModel) => {
      setModel((prev) => {
        // Emit PAGE_ADDED / PAGE_REMOVED when page count changes
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

  // Expose emitExportComplete so FidelityCanvas can call it when export finishes.
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
        onModelChange={handleModelChange}
      />
    </div>
  );
}
