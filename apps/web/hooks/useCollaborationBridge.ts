"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import type { Canvas, Textbox } from "fabric";
import type { FabricObjectWithMeta } from "@/types/editor";

const cursorContainers = new WeakMap<Canvas, Map<number, HTMLDivElement>>();

function getOverlays(canvas: Canvas): Map<number, HTMLDivElement> {
  let overlays = cursorContainers.get(canvas);
  if (!overlays) {
    overlays = new Map();
    cursorContainers.set(canvas, overlays);
  }
  return overlays;
}

function renderCursors(canvas: Canvas, awareness: Y.Awareness, localID: number) {
  const overlays = getOverlays(canvas);
  const active = new Set<number>();

  for (const [cid, state] of awareness.getStates()) {
    if (cid === localID) continue;
    const s = state as { user?: { name: string; color: string }; cursor?: { x: number; y: number } };
    if (!s.user || !s.cursor) continue;
    active.add(cid);

    let el = overlays.get(cid);
    if (!el) {
      el = document.createElement("div");
      el.className = "collab-cursor";
      Object.assign(el.style, {
        position: "absolute",
        pointerEvents: "none",
        zIndex: "999",
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        transform: "translate(-50%, -50%)",
      });
      canvas.getElement().parentElement?.appendChild(el);
      overlays.set(cid, el);
    }
    el.style.left = `${s.cursor.x}px`;
    el.style.top = `${s.cursor.y}px`;
    el.style.background = s.user.color || "#888";
    el.title = s.user.name || "";
  }

  for (const [cid, el] of overlays) {
    if (!active.has(cid)) {
      el.remove();
      overlays.delete(cid);
    }
  }
}

export function useCollaborationBridge(
  ydocRef: RefObject<Y.Doc | null>,
  providerRef: RefObject<WebsocketProvider | null>,
  fabricCanvasesRef: RefObject<Map<number, Canvas>>,
  scale: number,
  saveDebounced: RefObject<{ cancel: () => void }>,
) {
  useEffect(() => {
    const ydoc = ydocRef.current;
    const provider = providerRef.current;
    if (!ydoc || !provider) return;
    const yBlocks = ydoc.getMap<Y.Map<unknown>>("blocks");
    const awareness = provider.awareness;

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

    const awarenessHandler = () => {
      for (const [, canvas] of fabricCanvasesRef.current.entries()) {
        renderCursors(canvas, awareness, awareness.clientID);
      }
    };

    const saveDebouncedCurrent = saveDebounced.current;
    yBlocks.observeDeep(observer);
    awareness.on("change", awarenessHandler);
    return () => {
      yBlocks.unobserveDeep(observer);
      awareness.off("change", awarenessHandler);
      saveDebouncedCurrent.cancel();
      for (const [, canvas] of fabricCanvasesRef.current.entries()) {
        const overlays = cursorContainers.get(canvas);
        if (overlays) {
          for (const [, el] of overlays) el.remove();
          cursorContainers.delete(canvas);
        }
      }
    };
  }, [ydocRef, providerRef, fabricCanvasesRef, scale, saveDebounced]);
}
