export type EditorSurface = "pdf_canvas" | "writer";
export type LayoutMode = "editable" | "fidelity";

export function shouldShowCanvasToolbarHost(
  editorSurface: EditorSurface,
  layoutMode: LayoutMode,
  hasModel: boolean,
) {
  return hasModel && (editorSurface === "pdf_canvas" || layoutMode === "fidelity");
}

export function shouldRenderInlineCanvasToolbar(toolbarHost: HTMLElement | null | undefined) {
  return toolbarHost === undefined;
}
