import { forwardJson } from "../../../../../_shared";

type Params = { params: Promise<{ id: string; pageIndex: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id, pageIndex } = await params;
  return forwardJson(`/api/documents/${id}/page/${pageIndex}/image`, { method: "GET" });
}
