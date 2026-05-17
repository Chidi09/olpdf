export type RectX0Y0X1Y1 = [number, number, number, number];
export type RectXYWH = [number, number, number, number];

export function rectFromXYWH(x: number, y: number, width: number, height: number): RectX0Y0X1Y1 {
  return [x, y, x + width, y + height];
}

export function rectToXYWH(rect: RectX0Y0X1Y1) {
  const [x0, y0, x1, y1] = rect;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function documentRectToCanvasRect(rect: RectX0Y0X1Y1, scale: number): RectX0Y0X1Y1 {
  return [rect[0] * scale, rect[1] * scale, rect[2] * scale, rect[3] * scale];
}

export function canvasRectToDocumentRect(rect: RectX0Y0X1Y1, scale: number): RectX0Y0X1Y1 {
  return [rect[0] / scale, rect[1] / scale, rect[2] / scale, rect[3] / scale];
}

export function normalizeRect(rect: number[] | undefined, fallback: RectX0Y0X1Y1): RectX0Y0X1Y1 {
  if (!rect || rect.length !== 4 || rect.some((v) => typeof v !== "number" || !Number.isFinite(v))) return fallback;
  return [rect[0], rect[1], rect[2], rect[3]];
}
