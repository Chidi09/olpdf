import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../_shared";

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

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = await getAccessToken(request);

  const { document_id, instruction } = body;
  if (!document_id || !instruction) {
    return NextResponse.json(
      { error: "document_id and instruction are required" },
      { status: 422 }
    );
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/pdf/magic/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ document_id, instruction }),
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
