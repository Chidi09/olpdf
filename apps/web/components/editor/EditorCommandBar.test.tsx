import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EditorCommandBar from "./EditorCommandBar";

describe("EditorCommandBar", () => {
  it("renders title and mode-aware controls", () => {
    render(
      <EditorCommandBar
        mode="editable"
        title="Doc"
        isSaving={false}
        canUseFidelity={true}
        onTitleChange={vi.fn()}
        onTitleBlur={vi.fn()}
        onModeToggle={vi.fn()}
        onExport={vi.fn()}
        isExporting={false}
      />
    );
    expect(screen.getByDisplayValue("Doc")).toBeTruthy();
    expect(screen.getByText("Fidelity")).toBeTruthy();
    expect(screen.getByText("Export")).toBeTruthy();
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("hides mode toggle when showModeToggle is false", () => {
    render(
      <EditorCommandBar
        mode="fidelity"
        title="Doc"
        isSaving={false}
        canUseFidelity={true}
        showModeToggle={false}
        onTitleChange={vi.fn()}
        onTitleBlur={vi.fn()}
        onModeToggle={vi.fn()}
        onExport={vi.fn()}
        isExporting={false}
      />
    );
    expect(screen.getByDisplayValue("Doc")).toBeTruthy();
    expect(screen.queryByText("Editable")).toBeNull();
    expect(screen.getByText("Export")).toBeTruthy();
  });
});
