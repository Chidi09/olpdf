import { forwardStream } from "../../../_shared";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { jobId } = await params;
  return forwardStream(`/api/documents/import/${jobId}/stream`);
}
