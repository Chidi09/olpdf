import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../../../_shared";

async function getAccessToken(request: Request): Promise<string | null> {
  try {
    const cookie = request.headers.get("cookie") || "";
    const token = cookie
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("olpdf_session="))
      ?.slice("olpdf_session=".length)
      ?.trim();
    return token || null;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params;
  const token = await getAccessToken(request);

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/pdf/magic/stream/${job_id}`,
      {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
        cache: "no-store",
      }
    );

    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
