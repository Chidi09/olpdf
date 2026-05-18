import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../../../../_shared";

const DEMO_TOKEN = (process.env.DEMO_USER_TOKEN || "").trim();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params;

  if (!DEMO_TOKEN) {
    return NextResponse.json({ error: "demo_unavailable" }, { status: 503 });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/pdf/magic/stream/${job_id}`, {
      headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
      cache: "no-store",
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "upstream_unavailable", detail: String(error) }, { status: 502 });
  }
}
