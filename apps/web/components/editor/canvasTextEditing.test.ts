/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { shouldEditFabricTextInPlace } from "./canvasTextEditing";

describe("canvas text editing", () => {
  it("edits Fabric text objects in place", () => {
    expect(shouldEditFabricTextInPlace("textbox")).toBe(true);
    expect(shouldEditFabricTextInPlace("i-text")).toBe(true);
    expect(shouldEditFabricTextInPlace("text")).toBe(true);
  });

  it("does not treat non-text canvas objects as text editors", () => {
    expect(shouldEditFabricTextInPlace("rect")).toBe(false);
    expect(shouldEditFabricTextInPlace("image")).toBe(false);
    expect(shouldEditFabricTextInPlace(undefined)).toBe(false);
  });
});
