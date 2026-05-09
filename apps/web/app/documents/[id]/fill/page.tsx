"use client";

import { useEffect, useState } from "react";
import { FormFillCanvas } from "@/components/editor/FormFillCanvas";
import type { DocumentModel } from "@olpdf/document-model";

type Params = { params: Promise<{ id: string }> };

export default function FillPage({ params }: Params) {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [model, setModel] = useState<DocumentModel | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { id } = await params;
      if (!mounted) return;
      setDocumentId(id);
      const res = await fetch(`/api/bff/documents/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { document_model?: DocumentModel };
      if (mounted) setModel(data.document_model ?? null);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [params]);

  if (!documentId || !model) {
    return <div className="p-8 text-sm text-[var(--text-secondary)]">Loading form...</div>;
  }

  return <FormFillCanvas documentId={documentId} model={model} />;
}
