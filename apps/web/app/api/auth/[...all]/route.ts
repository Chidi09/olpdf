import { NextResponse } from "next/server";

function gone() {
  return NextResponse.json({ error: "deprecated", message: "Use /api/auth/* BFF endpoints" }, { status: 410 });
}

export const GET = gone;
export const POST = gone;
