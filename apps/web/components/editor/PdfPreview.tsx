
"use client";

import { useDocumentPreviewQuery } from "@/hooks/useDocumentQueries";

export default function PdfPreview({ documentId }: { documentId: string }) {
    const { data } = useDocumentPreviewQuery(documentId);
    const src = data?.preview_url || `/api/bff/documents/${documentId}/preview`;

    return (
        <iframe 
            src={src}
            className="w-full h-full border-none"
            title="PDF Preview"
        />
    );
}
