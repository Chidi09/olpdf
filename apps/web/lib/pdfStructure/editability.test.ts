import { describe, expect, it } from "vitest";
import type { PdfStructuredBlock } from "@/types/nativePdf";
import { classifyEditability } from "./editability";

const baseBlock = (overrides: Partial<PdfStructuredBlock>): PdfStructuredBlock => ({
  id: "test-block",
  kind: "flow_text",
  pageIndex: 0,
  bbox: [10, 10, 100, 50],
  confidence: 0.9,
  editability: { mode: "flow_text", confidence: 0.9, reasons: [], allowedOperations: [] },
  sourceRefs: [],
  ...overrides,
});

describe("classifyEditability", () => {
  it("returns flow_text for text block with confidence > 0.8", () => {
    const result = classifyEditability(baseBlock({ kind: "flow_text", confidence: 0.9 }));
    expect(result.mode).toBe("flow_text");
    expect(result.allowedOperations).toContain("replace_text");
  });

  it("returns replaceable_image for image block", () => {
    const result = classifyEditability(baseBlock({ kind: "image", confidence: 0.7 }));
    expect(result.mode).toBe("replaceable_image");
    expect(result.allowedOperations).toContain("replace_image");
  });

  it("returns raster with OCR and overlay for raster block", () => {
    const result = classifyEditability(baseBlock({ kind: "raster", confidence: 0.3 }));
    expect(result.mode).toBe("raster");
    expect(result.allowedOperations).toContain("ocr");
    expect(result.allowedOperations).toContain("overlay_text");
  });

  it("returns unsupported with no direct edit operations", () => {
    const result = classifyEditability(baseBlock({ kind: "unsupported", confidence: 0 }));
    expect(result.mode).toBe("unsupported");
    expect(result.allowedOperations).toHaveLength(0);
  });
});
