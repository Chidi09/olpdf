import type { ShapeTool } from "@/store/useFidelityCanvasStore";

export function shouldInsertToolImmediately(tool: ShapeTool) {
  return tool !== "select" && tool !== "draw";
}

export function getActiveToolAfterToolbarClick(tool: ShapeTool): ShapeTool {
  return shouldInsertToolImmediately(tool) ? "select" : tool;
}

export function isPageDecorationTool(tool: ShapeTool) {
  return tool === "header_footer" || tool === "page_number";
}
