import { forwardJson } from "../_shared";
import { createEmptyDocumentModel } from "@/lib/documentTransformers";

export async function GET() {
  return forwardJson("/api/documents", { method: "GET" });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const model = createEmptyDocumentModel(crypto.randomUUID());
  if (typeof body?.title === "string" && body.title.trim()) {
    model.meta.title = body.title.trim();
  }

  return forwardJson("/api/documents/create", {
    method: "POST",
    body: JSON.stringify(model),
  });
}
