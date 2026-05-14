import type { ToolOperation, ToolId } from "./contracts";

interface CandidateOperation {
  operation: ToolOperation;
  scopeSize: number;
}

const TOOL_SCOPE_WEIGHTS: Record<ToolId, number> = {
  edit_selected_block: 1,
  apply_list_to_range: 2,
  format_section: 3,
  insert_table_at_anchor: 4,
  reflow_region: 5,
  set_page_numbering_scheme: 6,
};

export function estimateScopeSize(op: ToolOperation): number {
  const baseWeight = TOOL_SCOPE_WEIGHTS[op.toolId] ?? 5;
  const blockCount = op.anchor.blockIds?.length ?? 1;
  return baseWeight * blockCount;
}

export function pickMinimalOperation(candidates: ToolOperation[]): ToolOperation | null {
  if (candidates.length === 0) return null;

  const scored: CandidateOperation[] = candidates.map((op) => ({
    operation: op,
    scopeSize: estimateScopeSize(op),
  }));

  scored.sort((a, b) => a.scopeSize - b.scopeSize);
  return scored[0].operation;
}
