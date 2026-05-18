import { forwardDemoJson } from "../../_shared";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return forwardDemoJson("/api/pdf/magic/execute", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
