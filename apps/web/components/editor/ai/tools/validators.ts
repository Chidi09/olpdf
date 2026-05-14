import type { ToolOperation } from "./contracts";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateToolOperation(op: ToolOperation): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!op.toolId) {
    errors.push({ field: "toolId", message: "toolId is required" });
  }

  if (!op.anchor) {
    errors.push({ field: "anchor", message: "anchor is required" });
    return errors;
  }

  if (!op.anchor.blockIds || op.anchor.blockIds.length === 0) {
    errors.push({ field: "anchor.blockIds", message: "at least one blockId is required" });
  }

  if (typeof op.diffBudget !== "number" || op.diffBudget < 1) {
    errors.push({ field: "diffBudget", message: "diffBudget must be a positive number" });
  }

  if (!op.intent || op.intent.trim().length === 0) {
    errors.push({ field: "intent", message: "intent is required" });
  }

  return errors;
}

export function isOperationValid(op: ToolOperation): boolean {
  return validateToolOperation(op).length === 0;
}
