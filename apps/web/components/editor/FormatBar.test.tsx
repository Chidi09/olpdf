import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FormatBar from "./FormatBar";
import { useFidelityCanvasStore } from "@/store/useFidelityCanvasStore";

function selectTextBlock() {
  act(() => {
    useFidelityCanvasStore.getState().setSelectedBlock({
      blockId: "block-1",
      blockType: "paragraph",
      fontFamily: "Georgia",
      fontSize: 14,
      isBold: false,
      isItalic: false,
      color: "#111111",
      alignment: "left",
      left: 57.3,
      top: 66.8,
      width: 143.2,
      height: 24,
    });
  });
}

describe("FormatBar", () => {
  afterEach(() => {
    act(() => {
      useFidelityCanvasStore.getState().setSelectedBlock(null);
    });
    cleanup();
  });

  it("renders as a standalone sticky bar by default", () => {
    selectTextBlock();

    const { container } = render(<FormatBar />);

    expect(screen.getByText("paragraph")).toBeTruthy();
    expect(container.firstElementChild?.className).toContain("sticky");
    expect(container.firstElementChild?.className).toContain("top-[60px]");
  });

  it("renders as a compact embedded toolbar row", () => {
    selectTextBlock();

    const { container } = render(<FormatBar embedded />);

    expect(screen.getByText("paragraph")).toBeTruthy();
    expect(container.firstElementChild?.className).toContain("border-t");
    expect(container.firstElementChild?.className).not.toContain("sticky");
    expect(container.firstElementChild?.className).not.toContain("top-[60px]");
  });
});
