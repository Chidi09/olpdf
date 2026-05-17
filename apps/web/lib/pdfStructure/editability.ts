import type { PdfEditability, PdfStructuredBlock } from "@/types/nativePdf";

export function classifyEditability(block: {
  kind: PdfStructuredBlock["kind"];
  confidence: number;
}): PdfEditability {
  switch (block.kind) {
    case "flow_text": {
      const isHigh = block.confidence > 0.8;
      return {
        mode: "flow_text",
        confidence: block.confidence,
        reasons: isHigh ? [] : ["Low OCR confidence"],
        allowedOperations: isHigh
          ? ["replace_text", "format_text", "delete"]
          : ["overlay_text", "delete"],
      };
    }
    case "atomic_text": {
      return {
        mode: "atomic_text",
        confidence: block.confidence,
        reasons: [],
        allowedOperations: ["replace_text", "delete"],
      };
    }
    case "image": {
      return {
        mode: "replaceable_image",
        confidence: block.confidence,
        reasons: [],
        allowedOperations: ["replace_image", "move", "resize", "delete"],
      };
    }
    case "vector": {
      return {
        mode: "atomic_vector",
        confidence: block.confidence,
        reasons: ["Vector graphics"],
        allowedOperations: ["move", "resize", "delete"],
      };
    }
    case "raster": {
      return {
        mode: "raster",
        confidence: block.confidence,
        reasons: ["Flattened content"],
        allowedOperations: ["ocr", "overlay_text", "delete"],
      };
    }
    case "unsupported":
    default: {
      return {
        mode: "unsupported",
        confidence: block.confidence,
        reasons: ["Unsupported block type"],
        allowedOperations: [],
      };
    }
  }
}
