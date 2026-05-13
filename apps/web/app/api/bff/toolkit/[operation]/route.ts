import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../_shared";

const GO_SERVICE_URL = process.env.EXPORT_SERVICE_URL || "";
const GO_TOOLKIT_OPS = new Set(["merge", "split", "compress", "rotate", "watermark"]);

async function getAccessToken(): Promise<string | null> {
  try {
    const hdr = await headers();
    const cookie = hdr.get("cookie") || "";
    const token = cookie.split(";").map(v => v.trim()).find(v => v.startsWith("olpdf_session="))?.slice("olpdf_session=".length)?.trim();
    return token || null;
  } catch { return null; }
}

function buildPythonPath(operation: string, apiOp: string, docId: string): string {
  const needsDocId = operation !== "merge";
  let path = `/api/pdf/${apiOp}`;
  if (needsDocId) path += `?doc_id=${encodeURIComponent(docId)}`;
  return path;
}

function preparePythonBody(operation: string, body: Record<string, unknown>): Record<string, unknown> | null {
  const bodylessOps = new Set(["compress", "extract-images", "detect-forms"]);
  if (bodylessOps.has(operation)) return null;
  if (operation === "fill-forms") return (body?.payload || {}) as Record<string, unknown>;
  const { doc_id, ...rest } = body;
  return Object.keys(rest).length > 0 ? rest : null;
}

async function tryGoService(operation: string, body: Record<string, unknown>): Promise<Response | null> {
  if (!GO_SERVICE_URL || !GO_TOOLKIT_OPS.has(operation)) return null;
  try {
    const goRes = await fetch(`${GO_SERVICE_URL}/toolkit/${operation}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (goRes.ok) {
      const data = await goRes.json();
      return NextResponse.json(data, { status: goRes.status });
    }
  } catch {
    // Go service unavailable — fall back to Python
  }
  return null;
}

type Params = { params: Promise<{ operation: string }> };

export async function POST(request: Request, { params }: Params) {
  const { operation } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));

  const opMap: Record<string, string> = {
    merge: "merge", split: "split", compress: "compress", rotate: "rotate",
    watermark: "watermark", protect: "protect", redact: "redact",
    "extract-images": "extract-images", "detect-forms": "forms-detect", "fill-forms": "forms-fill",
  };
  const apiOp = opMap[operation];
  if (!apiOp) {
    return NextResponse.json({ error: "unsupported_operation" }, { status: 400 });
  }

  const docId = typeof body?.doc_id === "string" ? body.doc_id : "";
  const needsDocId = operation !== "merge";
  if (needsDocId && !docId) {
    return NextResponse.json({ error: "doc_id_required" }, { status: 422 });
  }

  // Try Go service first for supported operations
  const goResult = await tryGoService(operation, body);
  if (goResult) return goResult;

  // Fall back to Python API
  const token = await getAccessToken();
  const path = buildPythonPath(operation, apiOp, docId);
  const pythonBody = preparePythonBody(operation, body);

  try {
    const init: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token || ""}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    };
    if (pythonBody) init.body = JSON.stringify(pythonBody);

    const pyRes = await fetch(`${API_BASE_URL}${path}`, init);
    const data = await pyRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: pyRes.status });
  } catch (error) {
    return NextResponse.json(
      { error: "upstream_unavailable", detail: String(error) },
      { status: 502 }
    );
  }
}
