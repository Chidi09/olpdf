import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "../../_shared";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const qs = params.toString();
  const res = await fetch(`${API_BASE_URL}/api/publications?${qs}`, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });
  if (!res.ok) return NextResponse.json({ publications: [] });
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${API_BASE_URL}/api/publications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Publication failed" }));
    return NextResponse.json(err, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
