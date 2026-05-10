import { forwardJson } from "../../../../../../_shared";

type Params = { params: Promise<{ id: string; blockId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id, blockId } = await params;
  const body = await request.json().catch(() => ({}));
  return forwardJson(`/api/ai/documents/${id}/blocks/${blockId}/rewrite`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
