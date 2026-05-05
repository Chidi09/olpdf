import { forwardJson } from "../../../_shared";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { jobId } = await params;
  return forwardJson(`/api/documents/import/${jobId}/status`);
}
