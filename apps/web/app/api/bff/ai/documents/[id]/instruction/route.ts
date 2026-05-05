import { NextRequest } from "next/server";
import { forwardJson } from "../../../../_shared";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { instruction } = await req.json();
  return forwardJson(`/api/ai/documents/${id}/instruction`, {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });
}
