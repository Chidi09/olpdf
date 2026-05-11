import { NextResponse } from "next/server";
import { callAuth } from "../../_shared";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { response, data } = await callAuth("/auth/magic-link/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status: response.status });
}
