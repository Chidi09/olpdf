import { forwardJson } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  return forwardJson(`/api/books/${id}/meta`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
