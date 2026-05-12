import { forwardJson } from "../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  return forwardJson(`/api/documents/${id}`);
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  return forwardJson(`/api/documents/${id}`, { method: "DELETE" });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return forwardJson(`/api/documents/${id}/title`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
