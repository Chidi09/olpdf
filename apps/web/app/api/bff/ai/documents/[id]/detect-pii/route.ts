import { NextRequest } from "next/server";
import { forwardJson } from "../../../../_shared";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return forwardJson(`/api/ai/documents/${id}/detect-pii`, {
    method: "POST",
  });
}
