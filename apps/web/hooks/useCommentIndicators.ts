"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import { Ellipse, type Canvas } from "fabric";
import type { EditorComment } from "@/components/editor/CommentSidebar";
import type { FabricObjectWithMeta } from "@/types/editor";

export function renderCommentIndicators(
  canvas: Canvas,
  comments: EditorComment[],
  pageIndex: number,
  scale: number,
  onOpenThread: (threadKey: string) => void,
) {
  const existing = canvas.getObjects().filter((o) => (o as FabricObjectWithMeta).data?.isCommentIndicator);
  for (const obj of existing) canvas.remove(obj);

  const pageComments = comments.filter((c) => c.page_index === pageIndex && !c.resolved);
  const byBlock = new Map<string, EditorComment[]>();
  for (const c of pageComments) {
    const key = c.block_id ?? `page_${pageIndex}`;
    byBlock.set(key, [...(byBlock.get(key) ?? []), c]);
  }

  for (const [key, group] of byBlock.entries()) {
    const y = (group[0]?.position?.y ?? 50) * scale;
    const circle = new Ellipse({
      left: (canvas.width ?? 0) - 20,
      top: y,
      rx: 8,
      ry: 8,
      fill: "#f97316",
      selectable: false,
      evented: true,
      hoverCursor: "pointer",
    });
    (circle as FabricObjectWithMeta).data = { isCommentIndicator: true, blockId: key, commentIds: group.map((c) => c.id) };
    circle.on("mousedown", () => onOpenThread(key));
    canvas.add(circle);
  }
  canvas.renderAll();
}

export function useCommentIndicators(
  fabricCanvasesRef: RefObject<Map<number, Canvas>>,
  comments: EditorComment[],
  scale: number,
  onOpenThread: (threadKey: string) => void,
) {
  useEffect(() => {
    for (const [pageIndex, canvas] of fabricCanvasesRef.current.entries()) {
      renderCommentIndicators(canvas, comments, pageIndex, scale, onOpenThread);
    }
  }, [fabricCanvasesRef, comments, scale, onOpenThread]);
}
