import { describe, expect, it, vi } from "vitest";
import { hitTestLayoutObjects } from "./layoutHelpers";
import { createImageFrame } from "@/lib/pageLayout/assets";
import { createDefaultTableFrame } from "@/lib/pageLayout/table";
import { createShapeFrame, createSymbolFrame } from "@/lib/pageLayout/shapes";

describe("createImageFrame", () => {
  it("creates an image frame with the given properties", () => {
    const f = createImageFrame(10, 20, 300, 200, "https://example.com/img.png", "assets/doc-1/img.png");
    expect(f.type).toBe("image");
    expect(f.x).toBe(10);
    expect(f.y).toBe(20);
    expect(f.width).toBe(300);
    expect(f.height).toBe(200);
    expect(f.src).toBe("https://example.com/img.png");
    expect(f.objectKey).toBe("assets/doc-1/img.png");
  });
});

describe("createDefaultTableFrame", () => {
  it("creates a table with header row", () => {
    const t = createDefaultTableFrame(10, 20, 3, 4);
    expect(t.type).toBe("table");
    expect(t.rows).toBe(3);
    expect(t.cols).toBe(4);
    expect(t.cells[0][0]).toBe("Header 1");
    expect(t.cells[0][3]).toBe("Header 4");
    expect(t.cells[1][0]).toBe("");
  });

  it("defaults to 3x3", () => {
    const t = createDefaultTableFrame(0, 0);
    expect(t.rows).toBe(3);
    expect(t.cols).toBe(3);
  });
});

describe("createShapeFrame", () => {
  it("creates a rect shape", () => {
    const s = createShapeFrame("rect", 10, 20, 100, 80);
    expect(s.type).toBe("shape");
    expect(s.shapeType).toBe("rect");
  });

  it("creates an ellipse shape", () => {
    const s = createShapeFrame("ellipse", 10, 20);
    expect(s.shapeType).toBe("ellipse");
  });
});

describe("createSymbolFrame", () => {
  it("creates a symbol frame", () => {
    const s = createSymbolFrame("✓", 10, 20);
    expect(s.type).toBe("symbol");
    expect(s.symbol).toBe("✓");
  });
});

describe("hitTestLayoutObjects", () => {
  it("returns the topmost object containing a point", () => {
    const objects = [
      { id: "bottom", x: 10, y: 10, width: 100, height: 100, zIndex: 1, visible: true },
      { id: "top", x: 20, y: 20, width: 100, height: 100, zIndex: 2, visible: true },
    ];
    expect(hitTestLayoutObjects(objects, 30, 30)?.id).toBe("top");
  });

  it("returns null when point misses all objects", () => {
    expect(hitTestLayoutObjects([{ id: "a", x: 0, y: 0, width: 10, height: 10, zIndex: 1, visible: true }], 50, 50)).toBeNull();
  });

  it("skips invisible objects", () => {
    const objects = [
      { id: "visible", x: 0, y: 0, width: 100, height: 100, zIndex: 1, visible: true },
      { id: "hidden", x: 0, y: 0, width: 100, height: 100, zIndex: 2, visible: false },
    ];
    expect(hitTestLayoutObjects(objects, 10, 10)?.id).toBe("visible");
  });
});
