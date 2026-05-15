import { describe, expect, it } from "vitest";
import { summarizePublicationDiff } from "./publicationVersions";

describe("summarizePublicationDiff", () => {
  it("reports block count changes", () => {
    expect(summarizePublicationDiff(
      { snapshot: { blocks: [{ id: "a" }] } } as any,
      { snapshot: { blocks: [{ id: "a" }, { id: "b" }] } } as any,
    )).toEqual(["+1 block"]);
  });

  it("reports layout object changes", () => {
    expect(summarizePublicationDiff(
      { snapshot: { layout: { pages: [{ objects: [{ id: "a" }] }] } } } as any,
      { snapshot: { layout: { pages: [{ objects: [{ id: "a" }, { id: "b" }] }] } } } as any,
    )).toEqual(["+1 layout object"]);
  });

  it("reports both when both change", () => {
    expect(summarizePublicationDiff(
      { snapshot: { blocks: [{ id: "a" }], layout: { pages: [{ objects: [{ id: "x" }, { id: "y" }] }] } } } as any,
      { snapshot: { blocks: [{ id: "a" }, { id: "b" }], layout: { pages: [{ objects: [{ id: "x" }] }] } } } as any,
    )).toContain("+1 block");
  });

  it("reports negative deltas", () => {
    expect(summarizePublicationDiff(
      { snapshot: { blocks: [{ id: "a" }, { id: "b" }] } } as any,
      { snapshot: { blocks: [{ id: "a" }] } } as any,
    )).toEqual(["-1 block"]);
  });

  it("returns empty for identical publications", () => {
    expect(summarizePublicationDiff(
      { snapshot: { blocks: [{ id: "a" }] } } as any,
      { snapshot: { blocks: [{ id: "a" }] } } as any,
    )).toEqual([]);
  });
});
