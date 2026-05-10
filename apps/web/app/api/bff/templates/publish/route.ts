import { forwardJson } from "../../_shared";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return forwardJson(`/api/templates/publish`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
