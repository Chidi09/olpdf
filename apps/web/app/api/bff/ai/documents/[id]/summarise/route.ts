import { forwardJson } from "../../../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  const { id } = await params;
  return forwardJson(`/api/ai/documents/${id}/summarise`, {
    method: "POST",
  });
}
