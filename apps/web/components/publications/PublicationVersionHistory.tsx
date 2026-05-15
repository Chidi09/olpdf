"use client";

import { useEffect, useState, startTransition } from "react";
import { createPublicationVersion, listPublicationVersions, type PublicationDetail } from "@/lib/publications";
import { summarizePublicationDiff } from "@/lib/publicationVersions";

type Props = {
  slug: string;
  currentSourceId: string;
};

export default function PublicationVersionHistory({ slug, currentSourceId }: Props) {
  const [versions, setVersions] = useState<PublicationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPublicationVersions(slug)
      .then((items) => {
        if (!cancelled) setVersions([...items].sort((a, b) => b.version - a.version));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load versions");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const restore = (version: PublicationDetail) => {
    setError(null);
    setMessage(null);
    startTransition(() => {
      createPublicationVersion(slug, {
        source_type: "document",
        source_id: currentSourceId,
        title: version.title,
        description: version.description,
        snapshot: version.snapshot,
        visibility: version.visibility as any,
        artifact_links: version.artifact_links,
      })
        .then((result) => setMessage(`Restored as version ${result.version}`))
        .catch((err) => setError(err instanceof Error ? err.message : "Restore failed"));
    });
  };

  if (loading) return <div className="text-sm text-[var(--text-tertiary)]">Loading versions...</div>;
  if (error) return <div className="text-sm text-red-400">{error}</div>;

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Version history</h2>
      {message && <p className="mt-2 text-sm text-green-400">{message}</p>}
      <div className="mt-4 space-y-3">
        {versions.map((version, index) => {
          const previous = versions[index + 1];
          const diff = previous ? summarizePublicationDiff(previous, version) : ["Initial publication"];
          return (
            <article key={`${version.slug}-${version.version}`} className="rounded-lg border border-[var(--border-subtle)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Version {version.version}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{new Date(version.published_at).toLocaleString()}</div>
                </div>
                {index > 0 && (
                  <button className="rounded-md border border-[var(--border-subtle)] px-3 py-1 text-xs" onClick={() => restore(version)}>
                    Restore version {version.version}
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                {diff.map((item) => <span key={item}>{item}</span>)}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
