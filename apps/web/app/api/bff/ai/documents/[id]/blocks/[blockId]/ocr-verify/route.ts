import { forwardJson } from "../../../../../../../_shared";

type Params = { params: Promise<{ id: string; blockId: string }> };

export async function POST(_: Request, { params }: Params) {
  const { id, blockId } = await params;
  return forwardJson(`/api/ai/documents/${id}/blocks/${blockId}/ocr-verify`, {
    method: "POST",
  });
}
