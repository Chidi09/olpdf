import { NextRequest, NextResponse } from "next/server";
import { callAuth, setSessionCookie } from "../../../_shared";

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const code = req.nextUrl.searchParams.get("code") || "";
  const state = req.nextUrl.searchParams.get("state") || "";
  const callback = `${req.nextUrl.origin}/api/auth/oauth/${provider}/callback`;
  const query = new URLSearchParams({ code, state, callback }).toString();

  const { response, data } = await callAuth(`/auth/oauth/${provider}/callback?${query}`);
  if (!response.ok || !data?.token) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(data?.detail || "OAuth callback failed")}`, req.url));
  }

  const redirectTo = typeof data.next === "string" && data.next.startsWith("/") ? data.next : "/dashboard";
  const res = NextResponse.redirect(new URL(redirectTo, req.url));
  setSessionCookie(res, data.token);
  return res;
}
