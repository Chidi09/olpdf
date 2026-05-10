/**
 * Synchronous reflow — runs on the main thread for immediate feedback after
 * small edits. For large documents (> 30 pages) or full re-layouts, prefer
 * useReflowWorker which delegates to the background Web Worker.
 *
 * Two modes:
 *  1. reflowBlock  — fast, local: recalculates one changed block and pushes
 *                    siblings down, following next_block_id chains so text
 *                    flows correctly across columns and pages.
 *  2. reflowDocument — full pass: used after paste, delete, or style change.
 */

import type { Canvas, Textbox } from "fabric";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";

type PageDimension = { page_index: number; width: number; height: number };

const DEFAULT_PAGE_HEIGHT = 841.89;
const DEFAULT_PAGE_WIDTH  = 595.28;
const BOTTOM_MARGIN = 56;
const TOP_MARGIN    = 56;

function _blockHeight(block: DocumentBlock): number {
  const bb = block.bounding_box ?? [0, 0, 0, 0];
  return Math.max(bb[3] - bb[1], 0);
}

function _pageDim(pageDimensions: PageDimension[], pageIndex: number) {
  return (
    pageDimensions.find((p) => p.page_index === pageIndex) ?? {
      page_index: pageIndex,
      width: DEFAULT_PAGE_WIDTH,
      height: DEFAULT_PAGE_HEIGHT,
    }
  );
}

function _measureFabricHeight(
  block: DocumentBlock,
  canvas: Canvas,
  pageDim: PageDimension,
): number | null {
  const fabricObj = canvas
    .getObjects()
    .find(
      (o) => (o as { data?: { blockId?: string } }).data?.blockId === block.id,
    ) as Textbox | undefined;
  if (!fabricObj || fabricObj.type !== "textbox") return null;
  const scale = (canvas.width ?? 1) / (pageDim.width ?? DEFAULT_PAGE_WIDTH);
  return fabricObj.calcTextHeight() / scale + 4;
}

// ─── Linked block overflow ────────────────────────────────────────────────────

/**
 * When a block grows past the page bottom, the excess content spills into
 * the block referenced by next_block_id.  This implements the same "threaded
 * frame" model that InDesign/Word use for column and page flow.
 *
 * The heuristic: if the bottom edge of `block` after resizing exceeds
 * `maxY`, move the block to the top of the next page and continue the chain.
 */
function _resolveOverflow(
  block: DocumentBlock,
  newY0: number,
  newHeight: number,
  pageDimensions: PageDimension[],
): DocumentBlock {
  const bb   = block.bounding_box ?? [0, 0, 0, 0];
  const maxY = _pageDim(pageDimensions, block.page_index ?? 0).height - BOTTOM_MARGIN;

  if (newY0 + newHeight <= maxY) {
    return { ...block, bounding_box: [bb[0], newY0, bb[2], newY0 + newHeight] };
  }

  // Overflow: move to top of next page
  const nextPage = (block.page_index ?? 0) + 1;
  return {
    ...block,
    page_index: nextPage,
    bounding_box: [bb[0], TOP_MARGIN, bb[2], TOP_MARGIN + newHeight],
  };
}

// ─── reflowBlock (fast path, main thread) ────────────────────────────────────

export function reflowBlock(
  model: DocumentModel,
  changedBlockId: string,
  canvases: Map<number, Canvas>,
  pageDimensions: PageDimension[],
): DocumentModel {
  const blocks = [...(model.blocks ?? [])];
  const changedIdx = blocks.findIndex((b) => b.id === changedBlockId);
  if (changedIdx === -1) return model;

  const changed    = blocks[changedIdx];
  const changedBb  = changed.bounding_box ?? [0, 0, 0, 0];
  const pageIndex  = changed.page_index ?? 0;
  const colIndex   = changed.column_index ?? 0;
  const pageDim    = _pageDim(pageDimensions, pageIndex);

  // Prefer Fabric's measured height (accounts for actual font rendering)
  const canvas     = canvases.get(pageIndex);
  const fabricH    = canvas ? _measureFabricHeight(changed, canvas, pageDim) : null;
  const newHeight  = fabricH ?? _blockHeight(changed);
  const oldHeight  = _blockHeight(changed);
  const deltaY     = newHeight - oldHeight;

  if (Math.abs(deltaY) < 0.5) return model;

  blocks[changedIdx] = {
    ...changed,
    bounding_box: [changedBb[0], changedBb[1], changedBb[2], changedBb[1] + newHeight],
  };

  // Collect the set of block IDs in the next_block_id chain starting from
  // changedBlockId — these receive overflowed content rather than being pushed.
  const chainIds = new Set<string>();
  let cursor: DocumentBlock | undefined = changed;
  while (cursor?.next_block_id) {
    chainIds.add(cursor.next_block_id);
    cursor = blocks.find((b) => b.id === cursor!.next_block_id);
  }

  // Push all blocks below the changed block on the same page+column
  for (let i = 0; i < blocks.length; i++) {
    if (i === changedIdx) continue;
    const b   = blocks[i];
    const bb  = b.bounding_box ?? [0, 0, 0, 0];

    if (chainIds.has(b.id)) continue;
    if ((b.page_index ?? 0) !== pageIndex) continue;
    if ((b.column_index ?? 0) !== colIndex) continue;
    if (bb[1] <= changedBb[1]) continue;

    blocks[i] = _resolveOverflow(b, bb[1] + deltaY, _blockHeight(b), pageDimensions);
  }

  // Ensure page_dimensions covers any newly created pages
  const maxPage = Math.max(...blocks.map((b) => b.page_index ?? 0));
  let dims      = [...pageDimensions];
  for (let p = dims.length; p <= maxPage; p++) {
    const last = dims[dims.length - 1] ?? { page_index: 0, width: DEFAULT_PAGE_WIDTH, height: DEFAULT_PAGE_HEIGHT };
    dims = [...dims, { page_index: last.page_index + 1, width: last.width, height: last.height }];
  }

  return { ...model, blocks, page_dimensions: dims };
}

// ─── reflowDocument (full pass, for paste / delete / style changes) ───────────

export function reflowDocument(model: DocumentModel): DocumentModel {
  const pageDimensions = model.page_dimensions ?? [];
  const blocks = [...(model.blocks ?? [])].sort((a, b) => {
    const pi = (a.page_index ?? 0) - (b.page_index ?? 0);
    if (pi !== 0) return pi;
    const ci = (a.column_index ?? 0) - (b.column_index ?? 0);
    if (ci !== 0) return ci;
    return (a.bounding_box?.[1] ?? 0) - (b.bounding_box?.[1] ?? 0);
  });

  const result: DocumentBlock[] = [];
  // cursor per (page, column)
  const cursors = new Map<string, number>();

  for (const block of blocks) {
    const pageIndex = block.page_index ?? 0;
    const colIndex  = block.column_index ?? 0;
    const key       = `${pageIndex}:${colIndex}`;
    const cursorY   = cursors.get(key) ?? TOP_MARGIN;
    const height    = _blockHeight(block);
    const fontSize  = block.font_meta?.size ?? 11;

    const placed = _resolveOverflow(block, cursorY, height, pageDimensions);
    result.push(placed);
    cursors.set(key, (placed.bounding_box?.[3] ?? cursorY + height) + fontSize * 0.4);

    // If block was promoted to a new page, reset cursor for the new location
    if (placed.page_index !== pageIndex) {
      const newKey = `${placed.page_index}:${colIndex}`;
      cursors.set(newKey, (placed.bounding_box?.[3] ?? TOP_MARGIN + height) + fontSize * 0.4);
    }
  }

  const maxPage = result.reduce((m, b) => Math.max(m, b.page_index ?? 0), 0);
  let dims = [...pageDimensions];
  for (let p = dims.length; p <= maxPage; p++) {
    const last = dims[dims.length - 1] ?? { page_index: 0, width: DEFAULT_PAGE_WIDTH, height: DEFAULT_PAGE_HEIGHT };
    dims = [...dims, { page_index: last.page_index + 1, width: last.width, height: last.height }];
  }

  return { ...model, blocks: result, page_dimensions: dims };
}

// Legacy alias — callers using the old name keep working
export { reflowBlock as reflow };
