"use client";

import { useState } from "react";
import type { DocumentModel } from "@olpdf/document-model";
import { createPublication, type Visibility } from "@/lib/publications";
import { usePageLayoutStore } from "@/store/usePageLayoutStore";

type PublishDialogProps = {
  documentId: string;
  model: DocumentModel;
  onClose: () => void;
  onPublished: (slug: string, url: string) => void;
};

export default function PublishDialog({ documentId, model, onClose, onPublished }: PublishDialogProps) {
  const [title, setTitle] = useState((model.meta as Record<string, unknown>)?.title as string ?? "Untitled");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("unlisted");
  const [attachExport, setAttachExport] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const layoutDoc = usePageLayoutStore((s) => s.document);

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const snapshot: Record<string, unknown> = {
        schema_version: 1,
        source_type: "document",
        title,
        document_model: {
          meta: model.meta ?? {},
          blocks: model.blocks ?? [],
          page_dimensions: model.page_dimensions ?? [],
        },
        published_at: new Date().toISOString(),
      };

      if (layoutDoc) {
        snapshot.layout = {
          source_kind: layoutDoc.source.kind,
          original_pdf_key: layoutDoc.source.originalPdfKey,
          pages: layoutDoc.pages.map((p) => ({
            index: p.index,
            width: p.width,
            height: p.height,
            objects: p.objects.map((o) => ({
              id: o.id,
              type: o.type,
              x: o.x,
              y: o.y,
              width: o.width,
              height: o.height,
            })),
          })),
        };
      }

      const result = await createPublication({
        source_type: "document",
        source_id: documentId,
        title: title || "Untitled",
        description,
        snapshot,
        visibility,
      });

      onPublished(result.slug, result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publication failed");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">Publish</h2>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted (anyone with link)</option>
              <option value="private">Private (owner only)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={attachExport}
              onChange={(e) => setAttachExport(e.target.checked)}
              className="rounded border-white/20"
            />
            Include downloadable PDF export
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={publishing}
            className="rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || !title.trim()}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-[#e5e5e5] transition-colors disabled:opacity-40"
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
