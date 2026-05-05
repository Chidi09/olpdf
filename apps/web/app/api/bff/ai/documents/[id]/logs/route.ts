import { NextRequest } from "next/server";
import { forwardJson } from "../../../../_shared";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardJson(`/api/ai/documents/${id}/logs`, { method: "GET" });
}
