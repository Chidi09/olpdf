import { forwardJson } from "../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  return forwardJson(`/api/books/${id}`);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  return forwardJson(`/api/books/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
