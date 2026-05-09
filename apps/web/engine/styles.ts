import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";

export type SmartStylePreset = {
  id: string;
  label: string;
  fontFamily: string;
  bodySize: number;
  headingScale: number;
  color: string;
};

export const SMART_STYLE_PRESETS: SmartStylePreset[] = [
  { id: "classic", label: "Classic", fontFamily: "Georgia", bodySize: 11, headingScale: 1.45, color: "#111111" },
  { id: "modern", label: "Modern", fontFamily: "DM Sans", bodySize: 11, headingScale: 1.35, color: "#1f2937" },
  { id: "editorial", label: "Editorial", fontFamily: "Lora", bodySize: 12, headingScale: 1.5, color: "#111827" },
];

export function applySmartStyle(model: DocumentModel, preset: SmartStylePreset): DocumentModel {
  const blocks = (model.blocks ?? []).map((block) => applyStyleToBlock(block, preset));
  return {
    ...model,
    blocks,
    styles: {
      ...(model.styles as Record<string, unknown>),
      smart_preset: preset.id,
      font_family: preset.fontFamily,
      base_font_size: preset.bodySize,
      body_color: preset.color,
    },
  };
}

function applyStyleToBlock(block: DocumentBlock, preset: SmartStylePreset): DocumentBlock {
  const base = preset.bodySize;
  const size =
    block.type === "heading1" ? Math.round(base * preset.headingScale * 1.15) :
    block.type === "heading2" ? Math.round(base * preset.headingScale) :
    block.type === "heading3" ? Math.round(base * 1.2) :
    base;

  return {
    ...block,
    font_meta: {
      family: preset.fontFamily,
      size,
      color: preset.color,
      is_bold: block.type === "heading1" || block.type === "heading2" || block.type === "heading3" ? true : !!block.font_meta?.is_bold,
      is_italic: !!block.font_meta?.is_italic,
    },
  };
}
