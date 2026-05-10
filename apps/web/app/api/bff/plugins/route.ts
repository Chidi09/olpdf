import { forwardJson } from "../_shared";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const path = category ? `/api/plugins?category=${category}` : "/api/plugins";
  return forwardJson(path, { method: "GET" });
}
