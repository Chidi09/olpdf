import { forwardJson } from "../_shared";

export async function GET() {
  return forwardJson("/api/books", { method: "GET" });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "Untitled Book";
  return forwardJson("/api/books/create", {
    method: "POST",
    body: JSON.stringify({
      title,
      meta: {},
      front_matter: [],
      back_matter: [],
      chapters: [],
    }),
  });
}
