
import { NextRequest } from "next/server";
import { forwardJson } from "../../../../_shared";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; format: string }> }
) {
  const { id, format } = await params;
  const body = await req.json();
  return forwardJson(`/api/documents/${id}/export/${format}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
