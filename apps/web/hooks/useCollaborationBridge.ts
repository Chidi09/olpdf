"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import type { Canvas } from "fabric";
import type { FabricObjectWithMeta } from "@/types/editor";
import type { DocumentBlock } from "@olpdf/document-model";

const cursorContainers = new WeakMap<Canvas, Map<number, HTMLDivElement>>();

function getOverlays(canvas: Canvas): Map<number, HTMLDivElement> {
  let overlays = cursorContainers.get(canvas);
  if (!overlays) {
    overlays = new Map();
    cursorContainers.set(canvas, overlays);
  }
  return overlays;
}

function renderCursors(canvas: Canvas, awareness: WebsocketProvider["awareness"], localID: number) {
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
  provider: WebsocketProvider | null,
  fabricCanvasesRef: RefObject<Map<number, Canvas>>,
  scale: number,
  saveDebounced: RefObject<{ cancel: () => void }>,
  onRemoteBlocksChanged?: (blocks: DocumentBlock[]) => void,
) {
  useEffect(() => {
    const ydoc = ydocRef.current;
    if (!ydoc || !provider) return;
    const yBlocks = ydoc.getMap<Y.Map<unknown>>("blocks");
    const awareness = provider.awareness;

    const observer = () => {
      if (!onRemoteBlocksChanged) return;
      const blocks: DocumentBlock[] = [];
      for (const [id, yBlock] of yBlocks.entries()) {
        const obj: Record<string, unknown> = { id };
        for (const [k, v] of yBlock.entries()) {
          obj[k] = v;
        }
        blocks.push(obj as unknown as DocumentBlock);
      }
      onRemoteBlocksChanged(blocks);
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
  }, [ydocRef, provider, fabricCanvasesRef, scale, saveDebounced, onRemoteBlocksChanged]);
}
