"use client";

import type { RefObject } from "react";
import type { Canvas, Textbox } from "fabric";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";

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
    const updatedBlocks: DocumentBlock[] = canvas.getObjects().map((obj, idx) => {
      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const w = (obj.width ?? 1) * (obj.scaleX ?? 1);
      const h = (obj.height ?? 1) * (obj.scaleY ?? 1);
      const blockId = (obj as any).data?.blockId ?? `blk_canvas_${pageIndex}_${idx}_${Date.now()}`;
      const blockType = (obj as any).data?.blockType ?? "paragraph";
      const bbox: [number, number, number, number] = [left / scale, top / scale, (left + w) / scale, (top + h) / scale];

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
        } as DocumentBlock;
      }

      if (obj.type === "group") {
        const data = (obj as any).data ?? {};
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
        } as DocumentBlock;
      }

      return {
        id: blockId,
        type: "shape",
        content: obj.type === "i-text" ? ((obj as any).text || "") : "",
        bounding_box: bbox,
        style_overrides: {},
        fabric_data: {
          ...(obj.toObject() as Record<string, unknown>),
          ...((obj as any).data || {}),
          type: (obj as any).data?.shapeType || obj.type,
        },
        z_index: idx,
        page_index: pageIndex,
        confidence_score: 1,
        needs_review: false,
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
        const blockId = (obj as any).data?.blockId;
        if (!blockId) continue;
        const block = nextModel.blocks?.find((b) => b.id === blockId);
        if (!block || (block.page_index ?? 0) !== pageIndex) continue;
        const bbox = block.bounding_box ?? [0, 0, 0, 0];
        const [x0, y0, x1, y1] = bbox;
        obj.set({ left: x0 * scale, top: y0 * scale });
        if (obj.type === "textbox") {
          (obj as Textbox).set({ width: (x1 - x0) * scale, height: (y1 - y0) * scale });
        }
      }
      canvas.renderAll();
    }
  };

  const restoreFabricTextbox = (blockId: string, pageIndex: number, text: string) => {
    const canvas = fabricCanvasesRef.current.get(pageIndex);
    if (!canvas) return;
    const fabricObj = canvas.getObjects().find((o) => (o as any).data?.blockId === blockId) as Textbox | undefined;
    if (!fabricObj) return;
    fabricObj.set({ text, opacity: 1, evented: true, selectable: true });
    fabricObj.setCoords();
    canvas.renderAll();
  };

  return { syncCanvasToModel, applyReflowToCanvases, restoreFabricTextbox };
}
