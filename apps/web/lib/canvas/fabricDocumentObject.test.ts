import { describe, expect, it } from "vitest";
import { shouldPersistFabricObject } from "./fabricDocumentObject";

describe("fabric document object filtering", () => {
  it("persists objects with real block ids", () => {
    expect(shouldPersistFabricObject({ data: { blockId: "blk-1" } })).toBe(true);
  });

  it("does not persist search highlights", () => {
    expect(shouldPersistFabricObject({ data: { isHighlight: true } })).toBe(false);
  });

  it("does not persist OCR badges", () => {
    expect(shouldPersistFabricObject({ data: { isOcrBadge: true } })).toBe(false);
  });

  it("does not persist comment indicators", () => {
    expect(shouldPersistFabricObject({ data: { isCommentIndicator: true } })).toBe(false);
  });

  it("does not persist cursor overlays", () => {
    expect(shouldPersistFabricObject({ data: { isCursorOverlay: true } })).toBe(false);
  });

  it("does not persist objects with no blockId", () => {
    expect(shouldPersistFabricObject({ data: { something: true } })).toBe(false);
  });

  it("does not persist objects with no data field", () => {
    expect(shouldPersistFabricObject({})).toBe(false);
  });
});
