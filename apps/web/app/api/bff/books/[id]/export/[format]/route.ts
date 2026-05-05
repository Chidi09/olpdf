import { forwardJson } from "../../../../_shared";

type Params = { params: Promise<{ id: string; format: string }> };

export async function POST(_: Request, { params }: Params) {
  const { id, format } = await params;

  return forwardJson(`/api/books/${id}/export/${format}`, {
    method: "POST",
  });
}
