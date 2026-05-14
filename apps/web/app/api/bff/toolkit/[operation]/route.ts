import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../_shared";

const GO_SERVICE_URL = process.env.EXPORT_SERVICE_URL || "";
const GO_TOOLKIT_OPS = new Set(["merge", "split", "compress", "rotate", "watermark"]);

async function getAccessToken(request: Request): Promise<string | null> {
  try {
    const cookie = request.headers.get("cookie") || "";
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

async function tryGoServiceAsync(operation: string, body: Record<string, unknown>, token: string | null): Promise<Response | null> {
  if (!GO_SERVICE_URL || !GO_TOOLKIT_OPS.has(operation)) return null;
  try {
    // Add async=true to signal Go should return a job_id immediately
    const goUrl = new URL(`${GO_SERVICE_URL}/toolkit/${operation}`);
    goUrl.searchParams.set("async", "true");
    // Pass auth token as part of the body for async goroutine to use
    const enrichedBody = { ...body, _auth_token: token };
    const goRes = await fetch(goUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(enrichedBody),
      signal: AbortSignal.timeout(30000),
    });
    if (goRes.ok) {
      const data = await goRes.json();
      // If Go returned a job_id (202), return it as-is for the frontend to poll
      if (goRes.status === 202 || data.job_id) {
        return NextResponse.json(data, { status: 202 });
      }
      // Otherwise it's a synchronous response
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

  const token = await getAccessToken(request);

  // Try Go service first — it may return 202 with job_id for async processing
  const goResult = await tryGoServiceAsync(operation, body, token);
  if (goResult) return goResult;

  // Fall back to Python API for small/not-yet-migrated ops
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
