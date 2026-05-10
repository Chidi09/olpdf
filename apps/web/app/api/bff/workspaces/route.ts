import { forwardJson } from "../_shared";

export async function GET() {
  return forwardJson("/api/workspaces", { method: "GET" });
}
