import type { PdfStructuredBlock } from "@/types/nativePdf";

export type EditabilityDescription = {
  label: string;
  actions: string[];
};

const MODE_LABELS: Record<string, string> = {
  flow_text: "Editable paragraph",
  atomic_text: "Atomic text",
  replaceable_image: "Replaceable image",
  atomic_vector: "Vector graphic",
  raster: "Flattened image region",
  unsupported: "Unsupported",
};

const MODE_ACTIONS: Record<string, string[]> = {
  flow_text: ["Edit text", "Format text", "Delete"],
  atomic_text: ["Edit text", "Delete"],
  replaceable_image: ["Replace image", "Move", "Resize", "Delete"],
  atomic_vector: ["Move", "Resize", "Delete"],
  raster: ["Run OCR", "Overlay text", "Delete"],
  unsupported: [],
};

export function describeEditability(block: PdfStructuredBlock): EditabilityDescription {
  const mode = block.editability.mode;
  return {
    label: MODE_LABELS[mode] ?? "Unknown",
    actions: MODE_ACTIONS[mode] ?? [],
  };
}
