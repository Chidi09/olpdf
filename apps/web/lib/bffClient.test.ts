import { describe, expect, it, vi, beforeEach } from "vitest";
import { BffHttpError, bffPost, bffGet } from "./bffClient";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("bffPost", () => {
  it("includes backend detail in error message on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Font rendering error" }), { status: 422 }),
    );

    try {
      await bffPost("/test", {});
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(BffHttpError);
      expect((e as BffHttpError).message).toBe("Font rendering error");
      expect((e as BffHttpError).status).toBe(422);
    }
  });

  it("falls back to message when detail is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Something went wrong" }), { status: 400 }),
    );

    try {
      await bffPost("/test", {});
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BffHttpError).message).toBe("Something went wrong");
    }
  });

  it("falls back to status text when neither detail nor message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: "Internal Server Error" }),
    );

    try {
      await bffPost("/test", {});
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BffHttpError).message).toContain("BFF POST failed: 500");
    }
  });
});

describe("bffGet", () => {
  it("includes backend detail in error message on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Not found" }), { status: 404 }),
    );

    try {
      await bffGet("/test");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(BffHttpError);
      expect((e as BffHttpError).message).toBe("Not found");
      expect((e as BffHttpError).status).toBe(404);
    }
  });
});
