import { forwardJson } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return forwardJson(`/api/documents/${id}/operations`);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  return forwardJson(`/api/documents/${id}/operations`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
