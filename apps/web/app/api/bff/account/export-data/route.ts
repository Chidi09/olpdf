import { forwardRaw } from "../../_shared";

export async function GET() {
  return forwardRaw("/api/account/export-data", { method: "GET" });
}
