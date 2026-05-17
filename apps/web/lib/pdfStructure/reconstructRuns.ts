import type { PdfGlyph, PdfTextRun } from "@/types/nativePdf";

const BASELINE_TOLERANCE = 1;

function glyphsMatchStyle(a: PdfGlyph, b: PdfGlyph): boolean {
  return (
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.color === b.color &&
    Math.abs(a.baseline - b.baseline) <= BASELINE_TOLERANCE
  );
}

function horizontalGap(a: PdfGlyph, b: PdfGlyph): number {
  return b.bbox[0] - a.bbox[2];
}

function mergeBbox(glyphs: PdfGlyph[]): [number, number, number, number] {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const g of glyphs) {
    if (g.bbox[0] < left) left = g.bbox[0];
    if (g.bbox[1] < top) top = g.bbox[1];
    if (g.bbox[2] > right) right = g.bbox[2];
    if (g.bbox[3] > bottom) bottom = g.bbox[3];
  }
  return [left, top, right, bottom];
}

export function clusterGlyphsIntoRuns(glyphs: PdfGlyph[]): PdfTextRun[] {
  if (glyphs.length === 0) return [];

  const sorted = [...glyphs].sort((a, b) => {
    const bl = a.baseline - b.baseline;
    if (bl !== 0) return bl;
    return a.bbox[0] - b.bbox[0];
  });

  const runs: PdfTextRun[] = [];
  let current: PdfGlyph[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    const curr = sorted[i];

    const sameLine = Math.abs(prev.baseline - curr.baseline) <= BASELINE_TOLERANCE;
    const sameStyle = glyphsMatchStyle(prev, curr);
    const gap = horizontalGap(prev, curr);
    const maxGap = prev.fontSize * 1.5;

    if (sameLine && sameStyle && gap >= 0 && gap <= maxGap) {
      current.push(curr);
    } else {
      const bbox = mergeBbox(current);
      runs.push({
        id: `run-${current[0].id}`,
        text: current.map((g) => g.char).join(""),
        bbox,
        baseline: current[0].baseline,
        fontFamily: current[0].fontFamily,
        fontSize: current[0].fontSize,
        color: current[0].color,
        glyphs: [...current],
        sourceRefs: current.map((g) => g.sourceRef),
      });
      current = [curr];
    }
  }

  if (current.length > 0) {
    const bbox = mergeBbox(current);
    runs.push({
      id: `run-${current[0].id}`,
      text: current.map((g) => g.char).join(""),
      bbox,
      baseline: current[0].baseline,
      fontFamily: current[0].fontFamily,
      fontSize: current[0].fontSize,
      color: current[0].color,
      glyphs: [...current],
      sourceRefs: current.map((g) => g.sourceRef),
    });
  }

  return runs;
}
