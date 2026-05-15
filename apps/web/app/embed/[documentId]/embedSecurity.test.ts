import { describe, expect, it } from "vitest";
import { parseParentOrigin } from "./page";

describe("parseParentOrigin", () => {
  it("rejects missing origin", () => {
    expect(() => parseParentOrigin(undefined)).toThrow(/origin is required/i);
  });

  it("rejects empty origin", () => {
    expect(() => parseParentOrigin("")).toThrow(/origin is required/i);
  });

  it("rejects wildcard", () => {
    expect(() => parseParentOrigin("*")).toThrow(/origin is required/i);
  });

  it("accepts valid https origins", () => {
    expect(parseParentOrigin("https://example.com")).toBe("https://example.com");
  });

  it("accepts localhost", () => {
    expect(parseParentOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects invalid urls", () => {
    expect(() => parseParentOrigin("not-a-url")).toThrow();
  });
});
