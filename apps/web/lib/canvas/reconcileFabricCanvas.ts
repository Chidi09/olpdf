import type { Canvas, FabricObject, IText, Textbox } from "fabric";
import type { DocumentBlock } from "@olpdf/document-model";
import type { FabricObjectWithMeta } from "@/types/editor";
import { shouldPersistFabricObject } from "@/lib/canvas/fabricDocumentObject";
import { documentRectToCanvasRect } from "@/lib/geometry/rect";

export interface FabricObjectCreator {
  (block: DocumentBlock, scale: number): FabricObject | null;
}

export function reconcileFabricCanvas(
  canvas: Canvas,
  pageIndex: number,
  nextBlocks: DocumentBlock[],
  scale: number,
  createObject: FabricObjectCreator,
): void {
  const currentObjs = canvas.getObjects().filter((obj) => {
    const data = (obj as FabricObjectWithMeta).data;
    if (!data) return false;
    if (data.isHighlight || data.isOcrBadge || data.isCommentIndicator || data.isCursorOverlay) return false;
    return typeof data.blockId === "string";
  });

  const currentMap = new Map<string, FabricObject>();
  for (const obj of currentObjs) {
    const blockId = (obj as FabricObjectWithMeta).data?.blockId;
    if (blockId) currentMap.set(blockId, obj);
  }

  const nextIds = new Set(nextBlocks.map((b) => b.id));

  // 1. Remove objects whose blocks are gone
  for (const [blockId, obj] of currentMap) {
    if (!nextIds.has(blockId)) {
      canvas.remove(obj);
    }
  }

  // 2. Add new objects / update existing
  const anyEditing = canvas.getObjects().some((obj) => (obj as IText).isEditing === true);
  const batch: FabricObject[] = [];

  for (const block of nextBlocks) {
    const existingObj = currentMap.get(block.id);
    if (existingObj) {
      if (anyEditing) continue;

      const bbox = block.bounding_box ?? [0, 0, 0, 0];
      const [left, top, right, bottom] = documentRectToCanvasRect(bbox as [number, number, number, number], scale);
      existingObj.set({ left, top });

      if ((existingObj as Textbox).text !== undefined) {
        const tb = existingObj as Textbox;
        const newText = block.content ?? "";
        if (tb.text !== newText) {
          tb.set("text", newText);
        }
        tb.set("width", Math.max(right - left, 20));
        tb.set("height", Math.max(bottom - top, 20));
      }

      existingObj.setCoords();
    } else {
      if (anyEditing) continue;
      const fabricObj = createObject(block, scale);
      if (fabricObj) {
        (fabricObj as FabricObjectWithMeta).data = {
          ...((fabricObj as FabricObjectWithMeta).data ?? {}),
          blockId: block.id,
          blockType: (block as any).type ?? "paragraph",
        };
        batch.push(fabricObj);
      }
    }
  }

  for (const obj of batch) {
    canvas.add(obj);
  }

  canvas.renderAll();
}
