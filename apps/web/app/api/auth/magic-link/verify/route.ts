import { NextResponse } from "next/server";
import { callAuth, setSessionCookie } from "../../_shared";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { response, data } = await callAuth("/auth/magic-link/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  const res = NextResponse.json({ user: data.user });
  if (data.token) setSessionCookie(res, data.token);
  return res;
}
