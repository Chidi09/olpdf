import type { PdfDocumentOperation } from "@/types/nativePdf";

let counter = 0;

function nextId(): string {
  counter += 1;
  return `op-${Date.now()}-${counter}`;
}

function now(): string {
  return new Date().toISOString();
}

export function replaceRunText(
  blockId: string,
  runId: string,
  oldText: string,
  newText: string
): PdfDocumentOperation {
  return {
    id: nextId(),
    type: "replace_run_text",
    blockId,
    before: { runId, text: oldText },
    after: { runId, text: newText },
    createdAt: now(),
  };
}

export function formatRun(
  blockId: string,
  runId: string,
  oldFormat: Record<string, unknown>,
  newFormat: Record<string, unknown>
): PdfDocumentOperation {
  return {
    id: nextId(),
    type: "format_run",
    blockId,
    before: { runId, format: oldFormat },
    after: { runId, format: newFormat },
    createdAt: now(),
  };
}

export function moveBlock(
  blockId: string,
  oldBbox: [number, number, number, number],
  newBbox: [number, number, number, number]
): PdfDocumentOperation {
  return {
    id: nextId(),
    type: "move_block",
    blockId,
    before: { bbox: oldBbox },
    after: { bbox: newBbox },
    createdAt: now(),
  };
}

export function deleteBlock(blockId: string): PdfDocumentOperation {
  return {
    id: nextId(),
    type: "delete_block",
    blockId,
    before: {},
    after: { deleted: true },
    createdAt: now(),
  };
}
