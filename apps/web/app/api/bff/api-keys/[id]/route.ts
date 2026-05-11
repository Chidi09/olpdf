import { NextRequest } from "next/server";
import { forwardJson } from "../../_shared";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardJson(`/api/keys/${id}`, { method: "DELETE" });
}
