import { forwardJson } from "../../../../_shared";

type Params = { params: Promise<{ id: string; chapterId: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id, chapterId } = await params;
  const body = await request.json().catch(() => ({}));

  return forwardJson(`/api/books/${id}/chapters/${chapterId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id, chapterId } = await params;

  return forwardJson(`/api/books/${id}/chapters/${chapterId}`, {
    method: "DELETE",
  });
}
