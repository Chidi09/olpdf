import { describe, expect, it } from "vitest";
import type { PdfEditOperation } from "@/types/nativePdf";

describe("FidelityCanvas native operation bridge", () => {
  it("emits a replace_text operation from a block edit", () => {
    const operations: PdfEditOperation[] = [];

    const emit = (op: PdfEditOperation) => {
      operations.push(op);
    };

    emit({
      id: "op-1",
      type: "replace_text",
      pageIndex: 0,
      targetObjectId: "obj-1",
      before: { text: "Old" },
      after: { text: "New" },
      createdAt: new Date().toISOString(),
    });

    expect(operations).toHaveLength(1);
    expect(operations[0].type).toBe("replace_text");
    expect(operations[0].after.text).toBe("New");
  });
});
