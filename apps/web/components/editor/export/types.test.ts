import { describe, expect, it } from "vitest";
import { toExportErrorMessage } from "./types";

describe("toExportErrorMessage", () => {
  it("returns backend detail when present", () => {
    expect(toExportErrorMessage({ detail: "Font missing" })).toBe("Font missing");
  });

  it("returns fallback when payload is empty", () => {
    expect(toExportErrorMessage({})).toBe("Export failed. Please try again.");
  });

  it("returns fallback when detail is not a string", () => {
    expect(toExportErrorMessage({ detail: 42 })).toBe("Export failed. Please try again.");
  });

  it("returns fallback for null payload", () => {
    expect(toExportErrorMessage(null)).toBe("Export failed. Please try again.");
  });
});
