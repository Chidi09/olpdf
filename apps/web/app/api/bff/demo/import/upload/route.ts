import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../../_shared";

const DEMO_TOKEN = (process.env.DEMO_USER_TOKEN || "").trim();
const GO_SERVICE_URL = process.env.EXPORT_SERVICE_URL || "";

export async function POST(request: Request) {
  if (!DEMO_TOKEN) {
    return NextResponse.json({ error: "demo_unavailable" }, { status: 503 });
  }

  const goServiceUrl = GO_SERVICE_URL || API_BASE_URL;
  const contentType = request.headers.get("content-type") || "";

  try {
    const goRes = await fetch(`${goServiceUrl}/import/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEMO_TOKEN}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
      },
      body: request.body,
      cache: "no-store",
    });

    const data = await goRes.json().catch(() => ({}));

    if (!goRes.ok) {
      return NextResponse.json(data, { status: goRes.status });
    }

    return NextResponse.json({
      document_id: data.document_id,
      status: data.status || "queued",
      download_url: data.download_url,
    });
  } catch (error) {
    return NextResponse.json({ error: "upstream_unavailable", detail: String(error) }, { status: 502 });
  }
}
