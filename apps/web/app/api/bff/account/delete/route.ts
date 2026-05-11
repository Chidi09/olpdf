import { forwardJson } from "../../_shared";

export async function DELETE() {
  return forwardJson("/api/account/delete", { method: "DELETE" });
}
