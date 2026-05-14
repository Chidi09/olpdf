import { forwardJson } from "../../../_shared";
import { sanitizeDocumentModelForApi } from "@/lib/documentModelSanitizer";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const cleaned = sanitizeDocumentModelForApi(body?.document_model || {});

  return forwardJson(`/api/documents/${id}`, {
    method: "PUT",
    body: JSON.stringify(cleaned),
  });
}
