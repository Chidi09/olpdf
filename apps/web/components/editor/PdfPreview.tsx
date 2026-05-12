
"use client";

import { useDocumentPreviewQuery } from "@/hooks/useDocumentQueries";

export default function PdfPreview({ documentId }: { documentId: string }) {
    const { data, error, isLoading } = useDocumentPreviewQuery(documentId);
    const src = data?.preview_url;

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-black/20 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Loading preview
            </div>
        );
    }

    if (error || !src) {
        return (
            <div className="flex h-full w-full items-center justify-center border-t border-white/[0.04] bg-black/20 px-4 text-center">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Preview unavailable</p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">The editable canvas is still ready. Export to generate a PDF preview.</p>
                </div>
            </div>
        );
    }

    return (
        <iframe 
            src={src}
            className="w-full h-full border-none"
            title="PDF Preview"
        />
    );
}
