import { forwardJson } from "../../../../../_shared";

type Params = { params: Promise<{ id: string; commentId: string }> };

export async function PATCH(_: Request, { params }: Params) {
  const { id, commentId } = await params;
  return forwardJson(`/api/documents/${id}/comments/${commentId}/resolve`, {
    method: "PATCH",
  });
}
