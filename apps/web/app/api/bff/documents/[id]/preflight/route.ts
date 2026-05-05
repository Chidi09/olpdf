
import { NextRequest } from "next/server";
import { forwardJson } from "../../../_shared";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  return forwardJson(`/api/documents/${id}/preflight`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
