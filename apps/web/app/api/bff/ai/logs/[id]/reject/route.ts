import { NextRequest } from "next/server";
import { forwardJson } from "../../../../_shared";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardJson(`/api/ai/logs/${id}/reject`, { method: "POST" });
}
