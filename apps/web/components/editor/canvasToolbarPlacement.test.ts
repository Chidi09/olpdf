/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { shouldRenderInlineCanvasToolbar, shouldShowCanvasToolbarHost } from "./canvasToolbarPlacement";

describe("canvas toolbar placement", () => {
  it("shows the shared toolbar host for imported PDF canvas documents", () => {
    expect(shouldShowCanvasToolbarHost("pdf_canvas", "fidelity", true)).toBe(true);
  });

  it("shows the shared toolbar host for writer documents in fidelity mode", () => {
    expect(shouldShowCanvasToolbarHost("writer", "fidelity", true)).toBe(true);
  });

  it("hides the shared toolbar host for writer editable mode", () => {
    expect(shouldShowCanvasToolbarHost("writer", "editable", true)).toBe(false);
  });

  it("hides the shared toolbar host until a model is loaded", () => {
    expect(shouldShowCanvasToolbarHost("pdf_canvas", "fidelity", false)).toBe(false);
  });

  it("renders the canvas toolbar inline only when no external host is provided", () => {
    expect(shouldRenderInlineCanvasToolbar(undefined)).toBe(true);
    expect(shouldRenderInlineCanvasToolbar(null)).toBe(false);
    expect(shouldRenderInlineCanvasToolbar({} as HTMLElement)).toBe(false);
  });
});
