import type { DocumentModel } from "@olpdf/document-model";
import type { ToolOperation } from "./contracts";
import { isOperationValid } from "./validators";

export interface ApplyResult {
  success: boolean;
  model: DocumentModel;
  error?: string;
}

export function applyWithRollback(
  model: DocumentModel,
  operation: ToolOperation,
  applyFn: (model: DocumentModel, op: ToolOperation) => DocumentModel,
): ApplyResult {
  if (!isOperationValid(operation)) {
    return { success: false, model, error: "Invalid operation: missing anchor or budget" };
  }

  const snapshot: DocumentModel = JSON.parse(JSON.stringify(model));

  try {
    const nextModel = applyFn(model, operation);

    const preBlockCount = snapshot.blocks?.length ?? 0;
    const postBlockCount = nextModel.blocks?.length ?? 0;
    const changeMagnitude = Math.abs(postBlockCount - preBlockCount);

    if (changeMagnitude > operation.diffBudget * 3) {
      return {
        success: false,
        model: snapshot,
        error: `Operation exceeded diff budget (${changeMagnitude} > ${operation.diffBudget})`,
      };
    }

    return { success: true, model: nextModel };
  } catch (err) {
    return {
      success: false,
      model: snapshot,
      error: err instanceof Error ? err.message : "Unknown apply error",
    };
  }
}
