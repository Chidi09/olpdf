"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import * as Y from "yjs";
import type { Canvas, Textbox } from "fabric";
import type { FabricObjectWithMeta } from "@/types/editor";

export function useCollaborationBridge(
  ydocRef: RefObject<Y.Doc | null>,
  fabricCanvasesRef: RefObject<Map<number, Canvas>>,
  scale: number,
  saveDebounced: RefObject<{ cancel: () => void }>,
) {
  useEffect(() => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;
    const yBlocks = ydoc.getMap<Y.Map<unknown>>("blocks");

    const observer = () => {
      for (const [, canvas] of fabricCanvasesRef.current.entries()) {
        for (const obj of canvas.getObjects()) {
          const blockId = (obj as FabricObjectWithMeta).data?.blockId;
          if (!blockId) continue;
          const yBlock = yBlocks.get(blockId);
          if (!yBlock) continue;

          const bbox = yBlock.get("bounding_box") as number[] | undefined;
          if (bbox?.length === 4) {
            obj.set({ left: bbox[0] * scale, top: bbox[1] * scale });
            obj.setCoords();
          }

          if (obj.type === "textbox") {
            const content = yBlock.get("content") as string | undefined;
            if (content !== undefined && (obj as Textbox).text !== content) {
              (obj as Textbox).set("text", content);
            }
          }
          canvas.renderAll();
        }
      }
    };

    yBlocks.observeDeep(observer);
    return () => {
      yBlocks.unobserveDeep(observer);
      saveDebounced.current.cancel();
    };
  }, [ydocRef, fabricCanvasesRef, scale, saveDebounced]);
}
