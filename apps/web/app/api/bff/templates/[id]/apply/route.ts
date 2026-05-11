import { forwardJson } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));

  let workspaceId = typeof body?.workspace_id === "string" ? body.workspace_id : "";
  if (!workspaceId) {
    const wsRes = await forwardJson("/api/workspaces", { method: "GET" });
    const wsBody = await wsRes.json().catch(() => [] as Array<{ id: string }>);
    workspaceId = Array.isArray(wsBody) && wsBody[0]?.id ? String(wsBody[0].id) : "";
  }
  if (!workspaceId) {
    return Response.json({ error: "workspace_not_found" }, { status: 400 });
  }

  return forwardJson(`/templates/${id}/apply?workspace_id=${encodeURIComponent(workspaceId)}`, {
    method: "POST",
  });
}
