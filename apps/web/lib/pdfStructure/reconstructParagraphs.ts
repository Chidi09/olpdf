import type { PdfStructuredBlock, PdfTextLine } from "@/types/nativePdf";

function estimateFontSize(line: PdfTextLine): number {
  if (line.runs.length > 0 && line.runs[0].fontSize > 0) {
    return line.runs[0].fontSize;
  }
  return line.bbox[3] - line.bbox[1];
}

function verticalGap(prev: PdfTextLine, curr: PdfTextLine): number {
  return curr.baseline - prev.baseline;
}

function leftEdgeDiff(prev: PdfTextLine, curr: PdfTextLine): number {
  return Math.abs(curr.bbox[0] - prev.bbox[0]);
}

export function groupLinesIntoParagraphBlocks(
  pageIndex: number,
  lines: PdfTextLine[]
): PdfStructuredBlock[] {
  if (lines.length === 0) return [];

  const sorted = [...lines].sort((a, b) => {
    const bl = a.baseline - b.baseline;
    if (bl !== 0) return bl;
    return a.bbox[0] - b.bbox[0];
  });

  const blocks: PdfStructuredBlock[] = [];
  let current: PdfTextLine[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const fontSize = estimateFontSize(prev);
    const gapTolerance = fontSize * 1.8;
    const edgeTolerance = fontSize * 2;

    const gap = verticalGap(prev, curr);
    const edge = leftEdgeDiff(prev, curr);

    if (gap <= gapTolerance && edge <= edgeTolerance) {
      current.push(curr);
    } else {
      blocks.push(buildBlock(pageIndex, current));
      current = [curr];
    }
  }

  if (current.length > 0) {
    blocks.push(buildBlock(pageIndex, current));
  }

  return blocks;
}

function buildBlock(pageIndex: number, lines: PdfTextLine[]): PdfStructuredBlock {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const l of lines) {
    if (l.bbox[0] < left) left = l.bbox[0];
    if (l.bbox[1] < top) top = l.bbox[1];
    if (l.bbox[2] > right) right = l.bbox[2];
    if (l.bbox[3] > bottom) bottom = l.bbox[3];
  }

  return {
    id: `block-${pageIndex}-${lines[0].id}`,
    kind: "flow_text",
    pageIndex,
    bbox: [left, top, right, bottom],
    confidence: 0.85,
    editability: {
      mode: "flow_text",
      confidence: 0.85,
      reasons: [],
      allowedOperations: ["replace_text", "format_text", "delete"],
    },
    lines,
    sourceRefs: lines.flatMap((l) => l.runs.flatMap((r) => r.sourceRefs)),
  };
}
