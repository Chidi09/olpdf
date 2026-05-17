import { describe, expect, it } from "vitest";
import { replaceRunText, formatRun, moveBlock, deleteBlock } from "./operations";

describe("operation builders", () => {
  it("replaceRunText creates operation with before/after text", () => {
    const op = replaceRunText("block-1", "run-1", "old text", "new text");
    expect(op.type).toBe("replace_run_text");
    expect(op.blockId).toBe("block-1");
    expect(op.before).toEqual({ runId: "run-1", text: "old text" });
    expect(op.after).toEqual({ runId: "run-1", text: "new text" });
    expect(op.createdAt).toBeTruthy();
  });

  it("formatRun creates operation with before/after format", () => {
    const op = formatRun("block-1", "run-1", { color: "#000" }, { color: "#ff0000" });
    expect(op.type).toBe("format_run");
    expect(op.before).toEqual({ runId: "run-1", format: { color: "#000" } });
    expect(op.after).toEqual({ runId: "run-1", format: { color: "#ff0000" } });
  });

  it("moveBlock creates operation with before/after bbox", () => {
    const op = moveBlock("block-1", [0, 0, 100, 50], [10, 10, 110, 60]);
    expect(op.type).toBe("move_block");
    expect(op.before).toEqual({ bbox: [0, 0, 100, 50] });
    expect(op.after).toEqual({ bbox: [10, 10, 110, 60] });
  });

  it("deleteBlock creates operation marking block as deleted", () => {
    const op = deleteBlock("block-1");
    expect(op.type).toBe("delete_block");
    expect(op.after).toEqual({ deleted: true });
  });
});
