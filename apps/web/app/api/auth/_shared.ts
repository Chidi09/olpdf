import { NextRequest, NextResponse } from "next/server";

export const AUTH_COOKIE = "olpdf_session";

export const API_BASE_URL =
  process.env.OLPDF_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function secureCookie(): boolean {
  return process.env.NODE_ENV !== "development";
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: 0,
  });
}

export function readSessionCookie(req: NextRequest): string | null {
  return req.cookies.get(AUTH_COOKIE)?.value?.trim() || null;
}

export async function callAuth(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
