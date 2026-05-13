import { NextResponse } from "next/server";
import { API_BASE_URL } from "../_shared";

function normalizeTemplate(raw: Record<string, unknown>) {
  return {
    id: raw.id,
    title: raw.title ?? "Untitled Template",
    category: raw.category ?? "General",
    author: raw.author ?? raw.author_name ?? "Community",
    uses_count: raw.uses_count ?? 0,
    thumbnail_url: raw.thumbnail_url ?? "",
    description: raw.description ?? "A professional-grade structural blueprint.",
  };
}

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/templates`, { method: "GET", cache: "no-store" });
    const raw = await response.json().catch(() => []);
    const data = Array.isArray(raw) ? raw.map(normalizeTemplate) : [];
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_unavailable", message: "Template registry unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
