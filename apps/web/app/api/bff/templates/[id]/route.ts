import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const response = await fetch(`${API_BASE_URL}/templates/${id}/preview`, { method: "GET", cache: "no-store" });
    const data = await response.json().catch(() => null);
    return NextResponse.json(data, { status: response.ok ? 200 : 404 });
  } catch {
    return NextResponse.json({ error: "preview_unavailable" }, { status: 502 });
  }
}
