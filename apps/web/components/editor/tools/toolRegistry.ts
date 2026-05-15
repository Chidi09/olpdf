export type ToolCategory = "select" | "text" | "insert" | "annotation" | "page" | "ai";

export type ToolAvailability = "always" | "needs_native_text" | "needs_selection" | "needs_page";

export type ToolDefinition = {
  id: string;
  label: string;
  category: ToolCategory;
  shortcut?: string;
  availability: ToolAvailability;
  disabledReason?: string;
};

export type RegistryToolId =
  | "select"
  | "insert_text"
  | "font"
  | "image"
  | "table"
  | "shape"
  | "symbol"
  | "header_footer"
  | "page_number"
  | "reorder_pages"
  | "comment"
  | "signature"
  | "highlight";

export type CanvasToolId =
  | "select"
  | "rect"
  | "roundedRect"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "sticky"
  | "draw"
  | "image"
  | "table"
  | "symbol"
  | "header_footer"
  | "page_number"
  | "reorder_pages"
  | "comment"
  | "signature"
  | "highlight";

export function canvasToolFromRegistryId(id: string): CanvasToolId {
  if (id === "insert_text") return "text";
  if (id === "shape") return "rect";
  return id as CanvasToolId;
}

export function registryIdFromCanvasTool(tool: string): RegistryToolId {
  if (tool === "text") return "insert_text";
  if (["rect", "roundedRect", "ellipse", "line", "arrow"].includes(tool)) return "shape";
  return tool as RegistryToolId;
}

const MILESTONE_ONE_TOOLS: ToolDefinition[] = [
  { id: "select", label: "Select", category: "select", shortcut: "V", availability: "always" },
  { id: "insert_text", label: "Text", category: "text", shortcut: "T", availability: "always" },
  { id: "font", label: "Font", category: "text", availability: "needs_selection" },
  { id: "image", label: "Image", category: "insert", shortcut: "I", availability: "always" },
  { id: "table", label: "Table", category: "insert", availability: "always" },
  { id: "shape", label: "Shape", category: "insert", shortcut: "S", availability: "always" },
  { id: "symbol", label: "Symbol", category: "insert", availability: "always" },
  { id: "header_footer", label: "Header/Footer", category: "page", availability: "always" },
  { id: "page_number", label: "Page Numbers", category: "page", availability: "always" },
  { id: "reorder_pages", label: "Reorder Pages", category: "page", availability: "always" },
  { id: "comment", label: "Comment", category: "annotation", shortcut: "C", availability: "always" },
  { id: "signature", label: "Signature", category: "annotation", availability: "always" },
  { id: "highlight", label: "Highlight", category: "annotation", shortcut: "H", availability: "always" },
];

export function getTools(): ToolDefinition[] {
  return MILESTONE_ONE_TOOLS;
}

export function getToolsByCategory(): Record<ToolCategory, ToolDefinition[]> {
  const grouped: Record<ToolCategory, ToolDefinition[]> = {
    select: [],
    text: [],
    insert: [],
    annotation: [],
    page: [],
    ai: [],
  };
  for (const tool of MILESTONE_ONE_TOOLS) {
    if (!grouped[tool.category]) grouped[tool.category] = [];
    grouped[tool.category].push(tool);
  }
  return grouped;
}

export function getTool(id: string): ToolDefinition | undefined {
  return MILESTONE_ONE_TOOLS.find((t) => t.id === id);
}
