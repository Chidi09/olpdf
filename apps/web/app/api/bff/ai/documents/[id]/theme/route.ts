import { NextRequest } from "next/server";
import { forwardJson } from "../../../../_shared";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  return forwardJson(`/api/ai/documents/${id}/theme`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
