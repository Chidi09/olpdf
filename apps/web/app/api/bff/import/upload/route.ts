import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../_shared";

const GO_SERVICE_URL = process.env.EXPORT_SERVICE_URL || "";

export async function POST(request: Request) {
  const goServiceUrl = GO_SERVICE_URL || API_BASE_URL;
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map(v => v.trim()).find(v => v.startsWith("olpdf_session="))?.slice("olpdf_session=".length)?.trim();

  // Forward the entire request body as-is to Go service
  try {
    const goRes = await fetch(`${goServiceUrl}/import/upload`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(request.headers.get("content-type") ? { "Content-Type": request.headers.get("content-type")! } : {}),
      },
      body: request.body,
      // No signal timeout — large uploads take time
      cache: "no-store",
    });

    const data = await goRes.json().catch(() => ({}));

    if (!goRes.ok) {
      return NextResponse.json(data, { status: goRes.status });
    }

    // Create BFF-proxied document record
    const docId = data.document_id;
    const docRes = await fetch(`${API_BASE_URL}/api/documents/${docId}`, {
      headers: {
        Authorization: `Bearer ${token || ""}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const docData = await docRes.json().catch(() => ({}));

    // Fall back to creating document if it doesn't exist
    if (docRes.status === 404 && docId) {
      const createRes = await fetch(`${API_BASE_URL}/api/documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: data.filename || "Imported PDF",
          document_model: { meta: {}, blocks: [], page_dimensions: [], styles: {} },
        }),
        cache: "no-store",
      });
      const created = await createRes.json().catch(() => ({}));
      if (createRes.ok && created.id) {
        data.document_id = created.id;
      }
    }

    return NextResponse.json({
      document_id: data.document_id,
      status: data.status || "queued",
      download_url: data.download_url,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_unavailable", detail: String(error) },
      { status: 502 },
    );
  }
}
