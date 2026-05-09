import { forwardJson } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return forwardJson(`/api/documents/${id}/snapshot`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
