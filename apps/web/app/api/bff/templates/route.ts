import { forwardJson } from "../_shared";

export async function GET() {
  return forwardJson("/templates", { method: "GET" });
}
