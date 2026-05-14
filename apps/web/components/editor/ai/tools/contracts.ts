export type ToolId =
  | "edit_selected_block"
  | "insert_table_at_anchor"
  | "apply_list_to_range"
  | "set_page_numbering_scheme"
  | "format_section"
  | "reflow_region";

export interface ToolAnchor {
  blockIds: string[];
  pageIndex?: number;
  startOffset?: number;
  endOffset?: number;
}

export interface ToolOperation {
  toolId: ToolId;
  anchor: ToolAnchor;
  intent: string;
  diffBudget: number; // max blocks affected
  parameters?: Record<string, unknown>;
}
