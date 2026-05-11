import { forwardJson } from "../../_shared";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const documentId = body?.document_id || body?.documentId;
  const fileBytes = body?.file_bytes || body?.fileBytes || "";
  const layoutMode = body?.layout_mode || body?.layoutMode || "editable";

  return forwardJson(`/api/documents/import/start`, {
    method: "POST",
    body: JSON.stringify({ document_id: documentId, file_bytes: fileBytes, layout_mode: layoutMode }),
  });
}
