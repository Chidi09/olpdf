import { forwardJson } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const query = encodeURIComponent(body?.query || "");

  return forwardJson(`/api/books/${id}/consistency?query=${query}`, {
    method: "POST",
  });
}
