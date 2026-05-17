"use client";

import type { RefObject } from "react";
import type { Canvas, IText, Textbox } from "fabric";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import type { FabricObjectWithMeta } from "@/types/editor";
import { shouldPersistFabricObject } from "@/lib/canvas/fabricDocumentObject";
import { rectFromCanvasObjectBounds, documentRectToCanvasRect, type RectX0Y0X1Y1 } from "@/lib/geometry/rect";

export function useModelSyncAndReflow(args: {
  model: DocumentModel;
  scale: number;
  fabricCanvasesRef: RefObject<Map<number, Canvas>>;
  setCurrentModel: (model: DocumentModel) => void;
  pushToHistory: (model: DocumentModel) => void;
  saveModel: (model: DocumentModel) => void;
}) {
  const { model, scale, fabricCanvasesRef, setCurrentModel, pushToHistory, saveModel } = args;

  const syncCanvasToModel = (pageIndex: number, canvas: Canvas) => {
    const documentObjects = canvas.getObjects().filter((obj) => shouldPersistFabricObject(obj as FabricObjectWithMeta));
    const updatedBlocks: DocumentBlock[] = documentObjects.map((obj, idx) => {
      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const w = (obj.width ?? 1) * (obj.scaleX ?? 1);
      const h = (obj.height ?? 1) * (obj.scaleY ?? 1);
      const blockId = (obj as FabricObjectWithMeta).data?.blockId ?? `blk_canvas_${pageIndex}_${idx}_${Date.now()}`;
      const blockType = (obj as FabricObjectWithMeta).data?.blockType ?? "paragraph";
      const bbox = rectFromCanvasObjectBounds(left, top, w, h, scale);

      if (obj.type === "textbox") {
        const tb = obj as Textbox;
        return {
          id: blockId,
          type: blockType,
          content: tb.text || "",
          bounding_box: bbox,
          font_meta: {
            family: tb.fontFamily || "Georgia",
            size: (tb.fontSize || 11) / scale,
            is_bold: tb.fontWeight === "bold",
            is_italic: tb.fontStyle === "italic",
            color: typeof tb.fill === "string" ? tb.fill : "#111111",
          },
          alignment: (tb.textAlign as string) || "left",
          confidence_score: 1,
          needs_review: false,
          style_overrides: {},
          z_index: idx,
          page_index: pageIndex,
          float: "none",
        } as DocumentBlock;
      }

      if (obj.type === "group") {
        const data = (obj as FabricObjectWithMeta).data ?? {};
        return {
          id: blockId,
          type: "table",
          content: "",
          bounding_box: bbox,
          table_data: data.table_data ?? { headers: [], rows: [] },
          style_overrides: {},
          z_index: idx,
          page_index: pageIndex,
          confidence_score: 1,
          needs_review: false,
          float: "none",
        } as DocumentBlock;
      }

      return {
        id: blockId,
        type: "shape",
        content: obj.type === "i-text" ? ((obj as IText).text || "") : "",
        bounding_box: bbox,
        style_overrides: {},
        fabric_data: {
          ...(obj.toObject() as Record<string, unknown>),
          ...((obj as FabricObjectWithMeta).data ?? {}),
          type: (obj as FabricObjectWithMeta).data?.shapeType ?? obj.type,
        },
        z_index: idx,
        page_index: pageIndex,
        confidence_score: 1,
        needs_review: false,
        float: "none",
      } as DocumentBlock;
    });

    const otherPages = (model.blocks ?? []).filter((b) => (b.page_index ?? 0) !== pageIndex);
    const nextModel: DocumentModel = { ...model, blocks: [...otherPages, ...updatedBlocks] };
    pushToHistory(nextModel);
    saveModel(nextModel);
    setCurrentModel(nextModel);
    return nextModel;
  };

  const applyReflowToCanvases = (nextModel: DocumentModel) => {
    for (const [pageIndex, canvas] of fabricCanvasesRef.current.entries()) {
      for (const obj of canvas.getObjects()) {
        const blockId = (obj as FabricObjectWithMeta).data?.blockId;
        if (!blockId) continue;
        const block = nextModel.blocks?.find((b) => b.id === blockId);
        if (!block || (block.page_index ?? 0) !== pageIndex) continue;
        const bbox = (block.bounding_box ?? [0, 0, 0, 0]) as RectX0Y0X1Y1;
        const [left, top, right, bottom] = documentRectToCanvasRect(bbox, scale);
        obj.set({ left, top });
        if (obj.type === "textbox") {
          (obj as Textbox).set({ width: right - left, height: bottom - top });
        }
      }
      canvas.renderAll();
    }
  };

  const restoreFabricTextbox = (blockId: string, pageIndex: number, text: string) => {
    const canvas = fabricCanvasesRef.current.get(pageIndex);
    if (!canvas) return;
    const fabricObj = canvas.getObjects().find((o) => (o as FabricObjectWithMeta).data?.blockId === blockId) as Textbox | undefined;
    if (!fabricObj) return;
    fabricObj.set({ text, opacity: 1, evented: true, selectable: true });
    fabricObj.setCoords();
    canvas.renderAll();
  };

  return { syncCanvasToModel, applyReflowToCanvases, restoreFabricTextbox };
}
