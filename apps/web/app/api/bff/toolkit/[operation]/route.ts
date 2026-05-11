import { forwardJson } from "../../_shared";

type Params = { params: Promise<{ operation: string }> };

export async function POST(request: Request, { params }: Params) {
  const { operation } = await params;
  const body = await request.json().catch(() => ({}));
  const opMap: Record<string, string> = {
    merge: "merge",
    split: "split",
    compress: "compress",
    rotate: "rotate",
    watermark: "watermark",
    protect: "protect",
    redact: "redact",
    "extract-images": "extract-images",
    "detect-forms": "forms-detect",
    "fill-forms": "forms-fill",
  };
  const apiOp = opMap[operation];
  if (!apiOp) {
    return Response.json({ error: "unsupported_operation" }, { status: 400 });
  }

  const docId = typeof body?.doc_id === "string" ? body.doc_id : "";
  const needsDocId = operation !== "merge";
  if (needsDocId && !docId) {
    return Response.json({ error: "doc_id_required" }, { status: 422 });
  }

  let payload: Record<string, unknown> = body || {};
  if (operation === "fill-forms") payload = (body?.payload || {}) as Record<string, unknown>;

  // Build endpoint with query doc_id where required by FastAPI route signatures.
  let path = `/api/pdf/${apiOp}`;
  if (needsDocId) {
    path += `?doc_id=${encodeURIComponent(docId)}`;
  }

  // Some routes only need query params and no body.
  const bodylessOps = new Set(["compress", "extract-images", "detect-forms"]);
  const init: RequestInit = {
    method: "POST",
  };
  if (!bodylessOps.has(operation)) {
    if (operation !== "fill-forms") {
      const { doc_id, ...rest } = payload;
      payload = rest;
    }
    init.body = JSON.stringify(payload);
  }

  return forwardJson(path, init);
}
