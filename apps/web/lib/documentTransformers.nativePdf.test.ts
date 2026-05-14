import { describe, expect, it } from "vitest";
import { mergeTiptapIntoNativePdfModel } from "./documentTransformers";

describe("native PDF editable transformer", () => {
  it("updates text by block id while preserving page_dimensions and bounding boxes", () => {
    const base = {
      id: "doc-1",
      meta: { title: "PDF", native_pdf: true, layout_mode: "fidelity" },
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
      blocks: [{ id: "blk_0", type: "paragraph", content: "Old", page_index: 0, bounding_box: [72, 72, 120, 90] as [number, number, number, number] }],
      styles: {},
    } as any;

    const next = mergeTiptapIntoNativePdfModel(base, {
      type: "doc",
      content: [{ type: "paragraph", attrs: { id: "blk_0" }, content: [{ type: "text", text: "New" }] }],
    });

    expect(next.blocks[0].content).toBe("New");
    expect(next.blocks[0].bounding_box).toEqual([72, 72, 120, 90]);
    expect(next.page_dimensions).toHaveLength(1);
    expect(next.meta?.title).toBe("PDF");
  });

  it("preserves block order and other blocks", () => {
    const base = {
      id: "doc-1",
      meta: { title: "PDF", native_pdf: true },
      page_dimensions: [],
      blocks: [
        { id: "blk_0", type: "paragraph", content: "One", page_index: 0, bounding_box: [0, 0, 10, 10] as [number, number, number, number] },
        { id: "blk_1", type: "paragraph", content: "Two", page_index: 0, bounding_box: [10, 0, 20, 10] as [number, number, number, number] },
      ],
      styles: {},
    } as any;

    const next = mergeTiptapIntoNativePdfModel(base, {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { id: "blk_0" }, content: [{ type: "text", text: "Updated" }] },
        { type: "paragraph", attrs: { id: "blk_1" }, content: [{ type: "text", text: "Two" }] },
      ],
    });

    expect(next.blocks).toHaveLength(2);
    expect(next.blocks[0].content).toBe("Updated");
    expect(next.blocks[1].content).toBe("Two");
  });
});
