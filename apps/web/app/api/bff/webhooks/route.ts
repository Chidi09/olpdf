import { NextRequest } from "next/server";
import { forwardJson } from "../_shared";

export async function GET(req: NextRequest) {
  return forwardJson("/api/webhooks", { method: "GET" });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return forwardJson("/api/webhooks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
