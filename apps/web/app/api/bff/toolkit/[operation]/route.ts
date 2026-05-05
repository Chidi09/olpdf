import { forwardJson } from "../../_shared";

type Params = { params: Promise<{ operation: string }> };

export async function POST(request: Request, { params }: Params) {
  const { operation } = await params;
  const body = await request.json().catch(() => ({}));
  const apiOp = operation === "extract-images" ? "extract-images" : operation;

  return forwardJson(`/api/pdf/${apiOp}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
