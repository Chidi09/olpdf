import { describe, expect, it } from "vitest";
import { canvasToolFromRegistryId, registryIdFromCanvasTool, getTool } from "./toolRegistry";

describe("tool id mapping", () => {
  it("maps registry text tool to the existing canvas text tool", () => {
    expect(getTool("insert_text")?.id).toBe("insert_text");
    expect(canvasToolFromRegistryId("insert_text")).toBe("text");
    expect(registryIdFromCanvasTool("text")).toBe("insert_text");
  });

  it("maps shape registry tool to a concrete default rectangle tool", () => {
    expect(canvasToolFromRegistryId("shape")).toBe("rect");
  });

  it("maps canvas rect/shape back to shape registry tool", () => {
    expect(registryIdFromCanvasTool("rect")).toBe("shape");
    expect(registryIdFromCanvasTool("roundedRect")).toBe("shape");
    expect(registryIdFromCanvasTool("ellipse")).toBe("shape");
  });

  it("passes through known direct-mapped tools", () => {
    expect(canvasToolFromRegistryId("image")).toBe("image");
    expect(canvasToolFromRegistryId("comment")).toBe("comment");
    expect(registryIdFromCanvasTool("image")).toBe("image");
    expect(registryIdFromCanvasTool("comment")).toBe("comment");
  });
});
