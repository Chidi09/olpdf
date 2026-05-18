import { notFound } from "next/navigation";
import PublicationVersionHistory from "@/components/publications/PublicationVersionHistory";

async function getPublication(slug: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/bff/publications/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function PublicationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pub = await getPublication(slug);
  if (!pub) notFound();

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold mb-2">{pub.title}</h1>
        {pub.description && (
          <p className="text-sm text-[var(--text-tertiary)] mb-6">{pub.description}</p>
        )}
        <div className="text-xs text-[var(--text-tertiary)] mb-8">
          Published · {pub.visibility === "public" ? "Public" : "Unlisted"}
        </div>

        <div className="space-y-2">
          {(pub.snapshot?.blocks ?? []).map((block: { id: string; content?: string; type?: string }) => (
            <div key={block.id} className="p-3 rounded-xl liquid-glass liquid-glass-noise">
              {block.content || "(empty)"}
            </div>
          ))}
        </div>

        <div className="mt-10">
          <PublicationVersionHistory slug={slug} currentSourceId={slug} />
        </div>
      </div>
    </main>
  );
}
