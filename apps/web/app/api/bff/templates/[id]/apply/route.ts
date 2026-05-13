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
  const path = workspaceId
    ? `/templates/${id}/apply?workspace_id=${encodeURIComponent(workspaceId)}`
    : `/templates/${id}/apply`;

  return forwardJson(path, {
    method: "POST",
  });
}
