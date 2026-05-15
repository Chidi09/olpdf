export type Visibility = "private" | "unlisted" | "public";

export type CreatePublicationPayload = {
  source_type: string;
  source_id: string;
  title: string;
  description?: string;
  snapshot: Record<string, unknown>;
  visibility?: Visibility;
  artifact_keys?: string[];
  artifact_links?: Array<{ url: string; filename: string }>;
};

export type PublicationResult = {
  slug: string;
  title: string;
  visibility: string;
  status: string;
  version: number;
  url: string;
  artifact_count: number;
};

export type PublicationDetail = {
  slug: string;
  title: string;
  description: string;
  visibility: string;
  status: string;
  version: number;
  snapshot: Record<string, unknown>;
  artifact_links?: Array<{ url: string; filename: string }>;
  published_at: string;
};

export async function createPublication(payload: CreatePublicationPayload): Promise<PublicationResult> {
  const res = await fetch("/api/bff/publications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Publication failed" }));
    throw new Error(err.detail ?? "Publication failed");
  }
  return res.json();
}

export async function getPublication(slug: string): Promise<PublicationDetail> {
  const res = await fetch(`/api/bff/publications/${slug}`);
  if (!res.ok) throw new Error("Publication not found");
  return res.json();
}

export async function listPublications(owner?: string, publicOnly = false): Promise<{ publications: PublicationDetail[] }> {
  const params = new URLSearchParams();
  if (owner) params.set("owner", owner);
  if (publicOnly) params.set("public", "true");
  const res = await fetch(`/api/bff/publications?${params}`);
  if (!res.ok) return { publications: [] };
  return res.json();
}

export async function unpublishPublication(slug: string): Promise<void> {
  const res = await fetch(`/api/bff/publications/${slug}/unpublish`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to unpublish");
}

export async function updatePublicationVisibility(slug: string, visibility: Visibility): Promise<void> {
  const res = await fetch(`/api/bff/publications/${slug}/visibility`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visibility }),
  });
  if (!res.ok) throw new Error("Failed to update visibility");
}

export async function listPublicationVersions(slug: string): Promise<PublicationDetail[]> {
  const res = await fetch(`/api/bff/publications/${slug}/versions`);
  if (!res.ok) return [];
  return res.json();
}

export async function createPublicationVersion(
  slug: string,
  payload: CreatePublicationPayload,
): Promise<PublicationResult> {
  const res = await fetch(`/api/bff/publications/${slug}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Version creation failed" }));
    throw new Error(err.detail ?? "Version creation failed");
  }
  return res.json();
}
