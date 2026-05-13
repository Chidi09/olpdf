import { forwardJson } from "../../../../_shared";

type Params = { params: Promise<{ id: string; key: string }> };

export async function POST(_: Request, { params }: Params) {
  const { id, key } = await params;

  return forwardJson(`/api/books/${id}/matter/${key}`, {
    method: "POST",
  });
}
