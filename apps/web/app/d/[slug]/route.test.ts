import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

function createMockRequest(cookie = "olpdf_session=test-token"): Request {
  return new Request("https://olpdf.xyz/d/abc12345", {
    headers: { cookie },
  });
}

describe("/d/[slug] route", () => {
  it("streams branded downloads without exposing storage URLs", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          url: "https://signed-r2.example/private?sig=abc",
          filename: "out.pdf",
          content_type: "application/pdf",
        }), { status: 200, headers: { "content-type": "application/json" } }),
      )
      .mockResolvedValueOnce(
        new Response("%PDF-1.7\ncontent", {
          status: 200,
          headers: { "content-type": "application/pdf", "content-length": "17" },
        }),
      );

    const { GET } = await import("./route");
    const res = await GET(createMockRequest(), { params: Promise.resolve({ slug: "abc12345" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("out.pdf");
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const text = await res.text();
    expect(text).toContain("%PDF");
  });

  it("returns 401 when no session cookie", async () => {
    const { GET } = await import("./route");
    const res = await GET(createMockRequest(""), { params: Promise.resolve({ slug: "abc12345" }) });

    expect(res.status).toBe(401);
  });

  it("returns 404 when slug not found", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "api_error", message: "Download link not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    const { GET } = await import("./route");
    const res = await GET(createMockRequest(), { params: Promise.resolve({ slug: "missing" }) });

    expect(res.status).toBe(404);
  });
});
