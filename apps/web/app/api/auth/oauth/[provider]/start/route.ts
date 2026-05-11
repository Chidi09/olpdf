import { NextRequest, NextResponse } from "next/server";
import { callAuth } from "../../../_shared";

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const next = req.nextUrl.searchParams.get("callbackURL") || "/dashboard";
  const callback = `${req.nextUrl.origin}/api/auth/oauth/${provider}/callback`;
  const query = new URLSearchParams({ callback, next }).toString();
  const { response, data } = await callAuth(`/auth/oauth/${provider}/start?${query}`);
  if (!response.ok || !data?.url) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(data?.detail || "OAuth failed")}`, req.url));
  }
  return NextResponse.redirect(data.url);
}
