import { describe, expect, it } from "vitest";
import type { PdfStructuredBlock } from "@/types/nativePdf";
import { describeEditability } from "./inspector";

const block = (overrides: Partial<PdfStructuredBlock>): PdfStructuredBlock => ({
  id: "test",
  kind: "flow_text",
  pageIndex: 0,
  bbox: [0, 0, 100, 50],
  confidence: 0.9,
  editability: { mode: "flow_text", confidence: 0.9, reasons: [], allowedOperations: [] },
  sourceRefs: [],
  ...overrides,
});

describe("describeEditability", () => {
  it("returns Editable paragraph for flow_text", () => {
    const d = describeEditability(block({ kind: "flow_text", editability: { mode: "flow_text", confidence: 0.9, reasons: [], allowedOperations: ["replace_text", "format_text", "delete"] } }));
    expect(d.label).toBe("Editable paragraph");
    expect(d.actions).toContain("Edit text");
  });

  it("returns Replaceable image for image", () => {
    const d = describeEditability(block({ kind: "image", editability: { mode: "replaceable_image", confidence: 0.9, reasons: [], allowedOperations: ["replace_image", "move", "resize", "delete"] } }));
    expect(d.label).toBe("Replaceable image");
    expect(d.actions).toContain("Replace image");
  });

  it("returns Flattened image region for raster", () => {
    const d = describeEditability(block({ kind: "raster", editability: { mode: "raster", confidence: 0.3, reasons: ["Flattened content"], allowedOperations: ["ocr", "overlay_text", "delete"] } }));
    expect(d.label).toBe("Flattened image region");
    expect(d.actions).toContain("Run OCR");
  });

  it("returns Unsupported for unsupported", () => {
    const d = describeEditability(block({ kind: "unsupported", editability: { mode: "unsupported", confidence: 0, reasons: ["Unsupported block type"], allowedOperations: [] } }));
    expect(d.label).toBe("Unsupported");
    expect(d.actions).toHaveLength(0);
  });
});
