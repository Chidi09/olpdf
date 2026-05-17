import { describe, expect, it } from "vitest";
import { canvasRectToDocumentRect, documentRectToCanvasRect, rectFromXYWH, rectToXYWH } from "./rect";

describe("rect geometry", () => {
  it("converts document rects to canvas rects", () => {
    expect(documentRectToCanvasRect([10, 20, 110, 70], 2)).toEqual([20, 40, 220, 140]);
  });

  it("converts canvas rects to document rects", () => {
    expect(canvasRectToDocumentRect([20, 40, 220, 140], 2)).toEqual([10, 20, 110, 70]);
  });

  it("converts xywh into x0y0x1y1", () => {
    expect(rectFromXYWH(10, 20, 100, 50)).toEqual([10, 20, 110, 70]);
  });

  it("converts x0y0x1y1 into xywh", () => {
    expect(rectToXYWH([10, 20, 110, 70])).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });
});
