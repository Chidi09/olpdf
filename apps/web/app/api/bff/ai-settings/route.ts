import { forwardJson } from "../_shared";

export async function GET() {
  return forwardJson("/api/ai-settings", { method: "GET" });
}

export async function PUT(request: Request) {
  const body = await request.text();
  return forwardJson("/api/ai-settings", {
    method: "PUT",
    body,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE() {
  return forwardJson("/api/ai-settings/key", { method: "DELETE" });
}
