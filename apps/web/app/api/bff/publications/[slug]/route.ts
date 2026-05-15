import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "../../_shared";

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await fetch(`${API_BASE_URL}/api/publications/${slug}`);
  if (!res.ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const data = await res.json();
  return NextResponse.json(data);
}
