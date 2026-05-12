import { forwardJson } from "../../_shared";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const documentId = body?.document_id || body?.documentId;
  const fileBytes = body?.file_bytes || body?.fileBytes || "";
  const layoutMode = body?.layout_mode || body?.layoutMode || "editable";
  const clientModel = body?.client_model || body?.clientModel;

  const payload: Record<string, unknown> = { document_id: documentId, file_bytes: fileBytes, layout_mode: layoutMode };
  if (clientModel) payload.client_model = clientModel;

  return forwardJson(`/api/documents/import/start`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
