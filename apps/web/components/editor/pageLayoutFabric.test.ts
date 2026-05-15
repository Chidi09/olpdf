import { describe, expect, it } from "vitest";
import { fabricSpecFromLayoutObject } from "./pageLayoutFabric";

const baseText = {
  id: "obj-1",
  type: "text" as const,
  content: "Hello",
  fontFamily: "Inter",
  fontSize: 12,
  fontWeight: "normal" as const,
  fontStyle: "normal" as const,
  underline: false,
  color: "#111111",
  textAlign: "left" as const,
  lineHeight: 1.25,
  letterSpacing: 0,
  bullets: false,
  numbering: false,
  visible: true,
  locked: false,
  zIndex: 0,
  opacity: 1,
  x: 10,
  y: 20,
  width: 200,
  height: 30,
  rotation: 0,
};

describe("fabricSpecFromLayoutObject", () => {
  it("maps text frames to textbox specs", () => {
    const spec = fabricSpecFromLayoutObject(baseText);
    expect(spec.kind).toBe("textbox");
    expect(spec.data.layoutObjectId).toBe("obj-1");
    expect(spec.options.left).toBe(10);
    expect(spec.options.top).toBe(20);
    expect(spec.options.width).toBe(200);
    expect(spec.options.fontSize).toBe(12);
    expect(spec.options.fill).toBe("#111111");
  });

  it("maps image frames to image specs", () => {
    const spec = fabricSpecFromLayoutObject({
      ...baseText,
      type: "image" as const,
      src: "https://example.com/img.png",
      width: 300,
      height: 200,
    });
    expect(spec.kind).toBe("image");
    expect(spec.data.layoutObjectId).toBe("obj-1");
  });

  it("maps shape rect frames to rect specs", () => {
    const spec = fabricSpecFromLayoutObject({
      ...baseText,
      type: "shape" as const,
      shapeType: "rect" as const,
      stroke: "#ff0000",
      strokeWidth: 2,
      fill: "#00ff00",
    });
    expect(spec.kind).toBe("rect");
    expect(spec.options.stroke).toBe("#ff0000");
    expect(spec.options.fill).toBe("#00ff00");
  });
});
