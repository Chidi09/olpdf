import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/app/api/bff/_shared";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith("olpdf_session="))?.slice("olpdf_session=".length)?.trim();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resolveRes = await fetch(`${API_BASE_URL}/api/downloads/${encodeURIComponent(slug)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!resolveRes.ok) {
    const body = await resolveRes.json().catch(() => ({}));
    return NextResponse.json(body, { status: resolveRes.status });
  }

  const meta = await resolveRes.json();
  const signedUrl: string = meta.url || meta.signed_url;
  if (!signedUrl) {
    return NextResponse.json({ error: "download_url_unavailable" }, { status: 502 });
  }

  const fileRes = await fetch(signedUrl, { cache: "no-store" });
  if (!fileRes.ok) {
    return NextResponse.json({ error: "download_source_unavailable" }, { status: 502 });
  }

  const fileBody = await fileRes.arrayBuffer();
  const filename = sanitizeFilename(meta.filename || "download.pdf");
  return new NextResponse(fileBody, {
    headers: {
      "Content-Type": meta.content_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(fileBody.byteLength),
    },
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/["\n\r]/g, "").trim() || "download.pdf";
}
