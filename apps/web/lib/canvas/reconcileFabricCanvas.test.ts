import { describe, expect, it } from "vitest";
import { shouldPersistFabricObject } from "./fabricDocumentObject";
import { documentRectToCanvasRect } from "@/lib/geometry/rect";

function planReconciliation(
  currentIds: string[],
  nextIds: string[],
): { toRemove: string[]; toAdd: string[]; toKeep: string[] } {
  const current = new Set(currentIds);
  const next = new Set(nextIds);
  const toRemove = currentIds.filter((id) => !next.has(id));
  const toAdd = nextIds.filter((id) => !current.has(id));
  const toKeep = currentIds.filter((id) => next.has(id));
  return { toRemove, toAdd, toKeep };
}

describe("reconciliation planning", () => {
  it("removes blocks not in next model", () => {
    const result = planReconciliation(["a", "b", "c"], ["a", "c"]);
    expect(result.toRemove).toEqual(["b"]);
    expect(result.toAdd).toEqual([]);
  });

  it("adds blocks not in current model", () => {
    const result = planReconciliation(["a"], ["a", "b", "c"]);
    expect(result.toAdd).toEqual(["b", "c"]);
    expect(result.toRemove).toEqual([]);
  });

  it("keeps blocks present in both", () => {
    const result = planReconciliation(["a", "b"], ["a", "b"]);
    expect(result.toKeep).toEqual(["a", "b"]);
    expect(result.toAdd).toEqual([]);
    expect(result.toRemove).toEqual([]);
  });

  it("handles empty next model (remove all)", () => {
    const result = planReconciliation(["a", "b"], []);
    expect(result.toRemove).toEqual(["a", "b"]);
    expect(result.toAdd).toEqual([]);
  });

  it("handles empty current model (add all)", () => {
    const result = planReconciliation([], ["a", "b"]);
    expect(result.toAdd).toEqual(["a", "b"]);
  });
});

describe("rect helper integration", () => {
  it("converts document rects for canvas correctly", () => {
    const result = documentRectToCanvasRect([10, 20, 110, 70], 2);
    expect(result).toEqual([20, 40, 220, 140]);
  });
});
