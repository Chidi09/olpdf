import { NextRequest, NextResponse } from "next/server";
import { callAuth, readSessionCookie } from "../_shared";

export async function GET(req: NextRequest) {
  const token = readSessionCookie(req);
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const { response, data } = await callAuth("/auth/session", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    return NextResponse.json({ user: null, error: data?.detail || "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user: data.user });
}
