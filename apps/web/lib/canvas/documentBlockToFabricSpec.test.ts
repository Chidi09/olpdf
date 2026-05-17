import { describe, expect, it } from "vitest";
import { blockToFabricSpec } from "./documentBlockToFabricSpec";

describe("blockToFabricSpec", () => {
  it("converts a text block to textbox spec", () => {
    const spec = blockToFabricSpec(
      {
        id: "b1",
        type: "paragraph",
        content: "Hello",
        bounding_box: [10, 20, 110, 40],
        font_meta: {
          family: "Helvetica",
          size: 12,
          color: "#111111",
          is_bold: false,
          is_italic: false,
        },
        alignment: "left",
      } as any,
      2,
    );

    expect(spec).toMatchObject({
      type: "textbox",
      left: 20,
      top: 40,
      width: 200,
      fontSize: 24,
      fontFamily: "Helvetica",
      text: "Hello",
    });
  });

  it("converts an image block to image spec", () => {
    const spec = blockToFabricSpec(
      {
        id: "b2",
        type: "image",
        bounding_box: [10, 20, 110, 70],
        src: "https://example.com/img.png",
      } as any,
      1,
    );

    expect(spec).toMatchObject({
      type: "image",
      left: 10,
      top: 20,
      width: 100,
      height: 50,
    });
  });

  it("converts a shape block to ellipse spec", () => {
    const spec = blockToFabricSpec(
      {
        id: "b3",
        type: "shape",
        bounding_box: [10, 20, 60, 70],
        fabric_data: { type: "ellipse" },
      } as any,
      1,
    );

    expect(spec).toMatchObject({ type: "ellipse", rx: 25, ry: 25 });
  });

  it("defaults unknown types to textbox", () => {
    const spec = blockToFabricSpec(
      {
        id: "b4",
        type: "heading1",
        content: "Title",
        bounding_box: [10, 20, 310, 40],
        font_meta: { size: 18 },
      } as any,
      1,
    );

    expect(spec).toMatchObject({
      type: "textbox",
      text: "Title",
      fontSize: 18,
    });
  });

  it("uses fallback bbox when none provided", () => {
    const spec = blockToFabricSpec(
      { id: "b5", type: "paragraph", content: "x" } as any,
      1,
    );
    expect(spec).not.toBeNull();
    if (spec && spec.type === "textbox") {
      expect(spec.left).toBeGreaterThan(0);
      expect(spec.top).toBeGreaterThan(0);
    }
  });
});
