import { forwardJson } from "../../../../_shared";

type Params = { params: Promise<{ id: string; plugin_id: string }> };

export async function POST(_: Request, { params }: Params) {
  const { id, plugin_id } = await params;
  return forwardJson(`/api/workspaces/${id}/plugins/${plugin_id}`, { method: "POST" });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id, plugin_id } = await params;
  return forwardJson(`/api/workspaces/${id}/plugins/${plugin_id}`, { method: "DELETE" });
}
