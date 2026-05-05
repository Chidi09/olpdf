import { forwardJson } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  return forwardJson(`/api/templates/${id}/apply`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
