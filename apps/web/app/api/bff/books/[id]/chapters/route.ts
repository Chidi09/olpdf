import { forwardJson } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  return forwardJson(`/api/books/${id}/chapters`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
