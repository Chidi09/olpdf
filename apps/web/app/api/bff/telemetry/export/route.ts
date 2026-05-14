import { NextRequest } from "next/server";
import { forwardJson } from "../../_shared";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return forwardJson("/api/telemetry/export", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
