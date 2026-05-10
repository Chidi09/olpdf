/**
 * Background reflow worker.
 *
 * Runs the full AST layout pass off the main thread so large-document
 * reflows never block the frame loop.
 *
 * Message protocol (main → worker):
 *   { type: "REFLOW"; id: string; model: DocumentModel; changedBlockId?: string }
 *
 * Message protocol (worker → main):
 *   { type: "REFLOW_COMPLETE"; id: string; model: DocumentModel }
 *   { type: "REFLOW_ERROR";    id: string; error: string }
 */

export {};

import type { DocumentModel } from "@olpdf/document-model";
import { buildASTFromModel, layoutAST, measureTextWidth } from "../engine/layout";

// Warm up the text measurement cache with common font/size combos so the
// first real reflow doesn't stall on cold measurement calls.
function _warmUp(): void {
  const fonts = [
    { family: "Georgia", size: 11 },
    { family: "Georgia", size: 16, is_bold: true },
    { family: "DM Sans", size: 11 },
    { family: "Lora", size: 12 },
  ];
  for (const f of fonts) {
    measureTextWidth("The quick brown fox", f);
  }
}

_warmUp();

self.addEventListener("message", (event: MessageEvent) => {
  const { type, id, model } = event.data as {
    type: string;
    id: string;
    model: DocumentModel;
    changedBlockId?: string;
  };

  if (type !== "REFLOW") return;

  try {
    const ast = buildASTFromModel(model);
    const { blocks, page_dimensions } = layoutAST(ast, model.page_dimensions ?? []);

    const reflowed: DocumentModel = {
      ...model,
      ast,
      blocks,
      page_dimensions,
    };

    self.postMessage({ type: "REFLOW_COMPLETE", id, model: reflowed });
  } catch (err) {
    self.postMessage({
      type: "REFLOW_ERROR",
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
