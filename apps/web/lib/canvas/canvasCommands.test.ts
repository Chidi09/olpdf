import { describe, expect, it } from "vitest";
import type { DocumentModel } from "@olpdf/document-model";
import { applyCommand, nativeOperationFromCommand } from "./canvasCommands";

const baseModel: DocumentModel = {
  id: "doc-1",
  meta: {
    title: "Test",
    author: "",
    page_size: "A4",
    margins: { top: 56, bottom: 56, left: 72, right: 72 },
    export_standard: "pdf_a",
    layout_mode: "fidelity",
  },
  blocks: [
    { id: "b1", type: "paragraph", content: "Hello", bounding_box: [0, 0, 100, 30] } as any,
    { id: "b2", type: "paragraph", content: "World", bounding_box: [0, 40, 100, 70] } as any,
  ],
  styles: {},
  page_dimensions: [],
} as DocumentModel;

describe("canvas commands", () => {
  it("replace_text updates block content", () => {
    const next = applyCommand(baseModel, { type: "replace_text", blockId: "b1", text: "Goodbye" });
    expect((next.blocks?.[0] as any).content).toBe("Goodbye");
    expect((next.blocks?.[1] as any).content).toBe("World");
  });

  it("move_resize updates block bbox", () => {
    const next = applyCommand(baseModel, { type: "move_resize", blockId: "b1", bbox: [10, 10, 110, 40] });
    expect((next.blocks?.[0] as any).bounding_box).toEqual([10, 10, 110, 40]);
  });

  it("delete_block removes block", () => {
    const next = applyCommand(baseModel, { type: "delete_block", blockId: "b1" });
    expect(next.blocks).toHaveLength(1);
    expect((next.blocks?.[0] as any).id).toBe("b2");
  });

  it("insert_block adds new block", () => {
    const newBlock = { id: "b3", type: "paragraph", content: "New" } as any;
    const next = applyCommand(baseModel, { type: "insert_block", block: newBlock });
    expect(next.blocks).toHaveLength(3);
    expect((next.blocks?.[2] as any).id).toBe("b3");
  });

  it("format_block patches block fields", () => {
    const next = applyCommand(baseModel, { type: "format_block", blockId: "b1", patch: { bounding_box: [5, 5, 105, 35] } });
    expect((next.blocks?.[0] as any).bounding_box).toEqual([5, 5, 105, 35]);
    expect((next.blocks?.[0] as any).content).toBe("Hello");
  });

  it("replace_blocks sets all blocks", () => {
    const newBlocks = [{ id: "b3", type: "paragraph", content: "Replaced" } as any];
    const next = applyCommand(baseModel, { type: "replace_blocks", blocks: newBlocks });
    expect(next.blocks).toHaveLength(1);
    expect((next.blocks?.[0] as any).id).toBe("b3");
  });

  it("returns same model for unknown blockId", () => {
    const next = applyCommand(baseModel, { type: "replace_text", blockId: "nonexistent", text: "x" });
    expect(next).toBe(baseModel);
  });

  it("delete_block returns same model for unknown blockId", () => {
    const next = applyCommand(baseModel, { type: "delete_block", blockId: "nonexistent" });
    expect(next).toBe(baseModel);
  });

  it("move_resize returns same model for unknown blockId", () => {
    const next = applyCommand(baseModel, { type: "move_resize", blockId: "nonexistent", bbox: [0, 0, 10, 10] });
    expect(next).toBe(baseModel);
  });

  it("format_block returns same model for unknown blockId", () => {
    const next = applyCommand(baseModel, { type: "format_block", blockId: "nonexistent", patch: { content: "x" } });
    expect(next).toBe(baseModel);
  });
});

it("returns same model for unknown command type", () => {
  const next = applyCommand(baseModel, { type: "unknown_type" } as any);
  expect(next).toBe(baseModel);
});

describe("nativeOperationFromCommand", () => {
  const model = {
    id: "doc-1",
    blocks: [
      { id: "b1", type: "paragraph", content: "Hello", bounding_box: [0, 0, 100, 30] },
    ] as any,
  } as DocumentModel;

  it("creates replace_text operation", () => {
    const op = nativeOperationFromCommand(
      { type: "replace_text", blockId: "b1", text: "Goodbye" },
      model, model, 0,
    );
    expect(op).toBeDefined();
    expect(op!.type).toBe("replace_text");
    expect(op!.before.text).toBe("Hello");
    expect(op!.after.text).toBe("Goodbye");
  });

  it("creates move_resize operation", () => {
    const op = nativeOperationFromCommand(
      { type: "move_resize", blockId: "b1", bbox: [10, 10, 110, 40] },
      model, model, 0,
    );
    expect(op).toBeDefined();
    expect(op!.type).toBe("move_object");
    expect(op!.after.bbox).toEqual([10, 10, 110, 40]);
  });

  it("creates delete_block operation", () => {
    const op = nativeOperationFromCommand(
      { type: "delete_block", blockId: "b1" },
      model, model, 0,
    );
    expect(op).toBeDefined();
    expect(op!.type).toBe("delete_object");
  });

  it("creates insert_block operation", () => {
    const newBlock = { id: "b2", type: "paragraph", content: "New" } as any;
    const op = nativeOperationFromCommand(
      { type: "insert_block", block: newBlock },
      model, model, 0,
    );
    expect(op).toBeDefined();
    expect(op!.type).toBe("insert_text");
  });
});
