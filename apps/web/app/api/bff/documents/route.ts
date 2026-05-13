import { NextResponse } from "next/server";
import { forwardJson } from "../_shared";
import { createEmptyDocumentModel } from "@/lib/documentTransformers";

export async function GET() {
  const upstream = await forwardJson("/api/documents", { method: "GET" });
  const raw = await upstream.json();
  // Python returns {documents:[...], page, limit} — normalize to plain array for all callers
  const data = Array.isArray(raw) ? raw : (Array.isArray(raw?.documents) ? raw.documents : raw);
  return NextResponse.json(data, { status: upstream.status });
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
