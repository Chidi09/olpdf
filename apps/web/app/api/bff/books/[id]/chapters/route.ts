import { forwardJson } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const chapterNumber = Number(body?.chapter_number || 1);

  return forwardJson(`/api/books/${id}/chapters`, {
    method: "POST",
    body: JSON.stringify({
      title: typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "Chapter 1",
      chapter_number: Number.isFinite(chapterNumber) && chapterNumber > 0 ? chapterNumber : 1,
      status: body?.status === "review" || body?.status === "final" ? body.status : "draft",
      word_count: Math.max(0, Number(body?.word_count || 0)),
      document_id: typeof body?.document_id === "string" && body.document_id.trim() ? body.document_id.trim() : null,
    }),
  });
}
