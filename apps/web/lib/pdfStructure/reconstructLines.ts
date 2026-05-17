import type { PdfTextLine, PdfTextRun } from "@/types/nativePdf";

function baselineTolerance(run: PdfTextRun): number {
  return Math.max(1, run.fontSize * 0.2);
}

export function groupRunsIntoLines(runs: PdfTextRun[]): PdfTextLine[] {
  if (runs.length === 0) return [];

  const sorted = [...runs].sort((a, b) => {
    const bl = a.baseline - b.baseline;
    if (bl !== 0) return bl;
    return a.bbox[0] - b.bbox[0];
  });

  const lines: PdfTextLine[] = [];
  let current: PdfTextRun[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    const curr = sorted[i];

    const tolerance = baselineTolerance(prev);
    const sameLine = Math.abs(prev.baseline - curr.baseline) <= tolerance;

    if (sameLine) {
      current.push(curr);
    } else {
      const lineBbox = mergeLineBbox(current);
      lines.push({
        id: `line-${current[0].id}`,
        bbox: lineBbox,
        baseline: current[0].baseline,
        runs: [...current],
      });
      current = [curr];
    }
  }

  if (current.length > 0) {
    const lineBbox = mergeLineBbox(current);
    lines.push({
      id: `line-${current[0].id}`,
      bbox: lineBbox,
      baseline: current[0].baseline,
      runs: current,
    });
  }

  return lines;
}

function mergeLineBbox(runs: PdfTextRun[]): [number, number, number, number] {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const r of runs) {
    if (r.bbox[0] < left) left = r.bbox[0];
    if (r.bbox[1] < top) top = r.bbox[1];
    if (r.bbox[2] > right) right = r.bbox[2];
    if (r.bbox[3] > bottom) bottom = r.bbox[3];
  }
  return [left, top, right, bottom];
}
