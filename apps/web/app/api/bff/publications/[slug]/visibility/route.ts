import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "../../../_shared";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json();
  const res = await fetch(`${API_BASE_URL}/api/publications/${slug}/visibility`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
