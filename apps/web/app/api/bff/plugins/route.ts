import { API_BASE_URL } from "../_shared";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function getAccessToken(): Promise<string | null> {
  try {
    const hdr = await headers();
    const cookie = hdr.get("cookie") || "";
    const token = cookie.split(";").map(v => v.trim()).find(v => v.startsWith("olpdf_session="))?.slice("olpdf_session=".length)?.trim();
    return token || null;
  } catch { return null; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const path = category ? `/api/plugins?category=${category}` : "/api/plugins";
  const origin = new URL(request.url).origin;
  const token = await getAccessToken();

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token || ""}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const raw = await response.json().catch(() => [] as Record<string, unknown>[]);
    const data = Array.isArray(raw) ? raw.map((p: Record<string, unknown>) => ({
      ...p,
      bundle_url: origin + "/plugins/" + (String(p.slug || p.id || "unknown")) + "/bundle.js",
      manifest: p.manifest || {
        name: p.name || "Plugin",
        version: "1.0.0",
        permissions: ["blocks:read"],
        hooks: ["onDocumentLoad"],
        entry: "bundle.js",
      },
    })) : raw;

    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
