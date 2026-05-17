/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { getActiveToolAfterToolbarClick, isPageDecorationTool, shouldInsertToolImmediately } from "./canvasToolBehavior";

describe("canvas tool behavior", () => {
  it("keeps select and draw as persistent modes", () => {
    expect(shouldInsertToolImmediately("select")).toBe(false);
    expect(shouldInsertToolImmediately("draw")).toBe(false);
  });

  it("runs insert tools immediately from the toolbar", () => {
    expect(shouldInsertToolImmediately("text")).toBe(true);
    expect(shouldInsertToolImmediately("image")).toBe(true);
    expect(shouldInsertToolImmediately("table")).toBe(true);
    expect(shouldInsertToolImmediately("highlight")).toBe(true);
    expect(shouldInsertToolImmediately("signature")).toBe(true);
  });

  it("identifies page decoration tools", () => {
    expect(isPageDecorationTool("header_footer")).toBe(true);
    expect(isPageDecorationTool("page_number")).toBe(true);
    expect(isPageDecorationTool("text")).toBe(false);
  });

  it("returns to select after one-shot insert tools", () => {
    expect(getActiveToolAfterToolbarClick("text")).toBe("select");
    expect(getActiveToolAfterToolbarClick("table")).toBe("select");
    expect(getActiveToolAfterToolbarClick("comment")).toBe("select");
  });

  it("keeps persistent toolbar tools active after click", () => {
    expect(getActiveToolAfterToolbarClick("select")).toBe("select");
    expect(getActiveToolAfterToolbarClick("draw")).toBe("draw");
  });
});
