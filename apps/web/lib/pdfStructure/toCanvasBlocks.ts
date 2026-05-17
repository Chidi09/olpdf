import type { PdfEditability, PdfStructuredBlock } from "@/types/nativePdf";

export type CanvasBlock = {
  blockId: string;
  kind: PdfStructuredBlock["kind"];
  pageIndex: number;
  bbox: [number, number, number, number];
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  editability: PdfEditability;
  sourceRefs: PdfStructuredBlock["sourceRefs"];
};

function extractText(block: PdfStructuredBlock): string | undefined {
  if (!block.lines) return undefined;
  return block.lines
    .flatMap((l) => l.runs)
    .map((r) => r.text)
    .join("");
}

function extractFontFromLines(block: PdfStructuredBlock): {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
} {
  const firstRun = block.lines?.[0]?.runs?.[0];
  if (!firstRun) return {};
  return {
    fontFamily: firstRun.fontFamily,
    fontSize: firstRun.fontSize,
    color: firstRun.color,
  };
}

export function toCanvasBlocks(blocks: PdfStructuredBlock[]): CanvasBlock[] {
  return blocks.map((block) => {
    const font = extractFontFromLines(block);
    return {
      blockId: block.id,
      kind: block.kind,
      pageIndex: block.pageIndex,
      bbox: block.bbox,
      text: extractText(block),
      ...font,
      editability: block.editability,
      sourceRefs: block.sourceRefs,
    };
  });
}
