import { forwardJson } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  return forwardJson(`/api/documents/${id}/preview`);
}
