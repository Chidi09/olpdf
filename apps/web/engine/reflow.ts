import type { Canvas, Textbox } from "fabric";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";

type PageDimension = { page_index: number; width: number; height: number };

const DEFAULT_PAGE_HEIGHT = 841.89;
const DEFAULT_PAGE_WIDTH = 595.28;
const BOTTOM_MARGIN = 56;
const TOP_MARGIN = 56;

function getBlockHeight(block: DocumentBlock): number {
  const bbox = block.bounding_box ?? [0, 0, 0, 0];
  return bbox[3] - bbox[1];
}

function overflowToNextPage(
  block: DocumentBlock,
  newY0: number,
  newY1: number,
): DocumentBlock {
  const bbox = block.bounding_box ?? [0, 0, 0, 0];
  const nextPageIndex = (block.page_index ?? 0) + 1;
  const blockHeight = newY1 - newY0;

  return {
    ...block,
    page_index: nextPageIndex,
    bounding_box: [bbox[0], TOP_MARGIN, bbox[2], TOP_MARGIN + blockHeight],
  };
}

export function reflow(
  model: DocumentModel,
  changedBlockId: string,
  canvases: Map<number, Canvas>,
  pageDimensions: PageDimension[],
): DocumentModel {
  const blocks = [...(model.blocks ?? [])];
  const changedIdx = blocks.findIndex((b) => b.id === changedBlockId);
  if (changedIdx === -1) return model;

  const changed = blocks[changedIdx];
  const changedBbox = changed.bounding_box ?? [0, 0, 0, 0];
  const pageIndex = changed.page_index ?? 0;
  const columnIndex = changed.column_index ?? 0;
  const pageDim = pageDimensions.find((p) => p.page_index === pageIndex);
  const pageHeight = pageDim?.height ?? DEFAULT_PAGE_HEIGHT;

  const canvas = canvases.get(pageIndex);
  let newHeight = getBlockHeight(changed);
  if (canvas) {
    const fabricObj = canvas
      .getObjects()
      .find((o) => (o as { data?: { blockId?: string } }).data?.blockId === changedBlockId) as Textbox | undefined;
    if (fabricObj && fabricObj.type === "textbox") {
      const scale = (canvas.width ?? 1) / (pageDim?.width ?? DEFAULT_PAGE_WIDTH);
      newHeight = fabricObj.calcTextHeight() / scale + 4;
    }
  }

  const oldHeight = getBlockHeight(changed);
  const deltaY = newHeight - oldHeight;
  if (Math.abs(deltaY) < 0.5) return model;

  blocks[changedIdx] = {
    ...changed,
    bounding_box: [changedBbox[0], changedBbox[1], changedBbox[2], changedBbox[1] + newHeight],
  };

  for (let i = 0; i < blocks.length; i += 1) {
    if (i === changedIdx) continue;
    const b = blocks[i];
    if ((b.page_index ?? 0) !== pageIndex || (b.column_index ?? 0) !== columnIndex) continue;
    const bbox = b.bounding_box ?? [0, 0, 0, 0];
    if (bbox[1] <= changedBbox[1]) continue;

    const newY0 = bbox[1] + deltaY;
    const newY1 = bbox[3] + deltaY;

    if (newY1 > pageHeight - BOTTOM_MARGIN) {
      blocks[i] = overflowToNextPage(b, newY0, newY1);
    } else {
      blocks[i] = {
        ...b,
        bounding_box: [bbox[0], newY0, bbox[2], newY1],
      };
    }
  }

  const needsNewPage = blocks.some((b) => (b.page_index ?? 0) >= pageDimensions.length);
  if (needsNewPage) {
    const lastDim = pageDimensions[pageDimensions.length - 1] ?? { page_index: 0, width: DEFAULT_PAGE_WIDTH, height: DEFAULT_PAGE_HEIGHT };
    const newPageDim = {
      page_index: lastDim.page_index + 1,
      width: lastDim.width,
      height: lastDim.height,
    };
    return {
      ...model,
      blocks,
      page_dimensions: [...(model.page_dimensions ?? []), newPageDim],
    };
  }

  return { ...model, blocks };
}
