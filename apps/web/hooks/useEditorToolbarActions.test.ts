import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditorToolbarActions } from "./useEditorToolbarActions";
import type { DocumentModel } from "@olpdf/document-model";

const baseModel: DocumentModel = {
  id: "doc-1",
  blocks: [
    { id: "b1", type: "paragraph", content: "A", bounding_box: [0, 0, 100, 30] },
    { id: "b2", type: "paragraph", content: "B", bounding_box: [0, 40, 100, 70] },
  ] as any,
  meta: {},
} as unknown as DocumentModel;

const modelB: DocumentModel = {
  ...baseModel,
  blocks: [{ id: "b1", type: "paragraph", content: "B updated" } as any],
} as unknown as DocumentModel;

describe("useEditorToolbarActions", () => {
  it("pushToHistory uses getCurrentModel for history entry", () => {
    const onModelChange = vi.fn();
    const saveModel = vi.fn();
    const setCurrentModel = vi.fn();
    const getCurrentModel = vi.fn(() => baseModel);

    const { result } = renderHook(() =>
      useEditorToolbarActions({
        model: baseModel,
        onModelChange,
        getCurrentModel,
        setCurrentModel,
        saveModel,
        documentId: "doc-1",
      }),
    );

    act(() => {
      result.current.pushToHistory(modelB);
    });

    expect(onModelChange).toHaveBeenCalledWith(modelB);

    act(() => {
      result.current.undo();
    });

    expect(onModelChange).toHaveBeenCalledWith(baseModel);
  });
});
