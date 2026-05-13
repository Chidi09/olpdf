import { forwardJson } from "../../../../../_shared";

type Params = { params: Promise<{ id: string; chapterId: string }> };

export async function POST(_: Request, { params }: Params) {
  const { id, chapterId } = await params;
  return forwardJson(`/api/books/${id}/chapters/${chapterId}/suggest-title`, { method: "POST" });
}
