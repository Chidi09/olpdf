"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import debounce from "lodash/debounce";
import { Canvas, Ellipse, Group, IText, Line, PencilBrush, Rect, Textbox } from "fabric";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import { useSaveDocumentMutation } from "@/hooks/useDocumentQueries";
import { useFidelityCanvasStore, type ShapeTool, type SelectedBlockMeta } from "@/store/useFidelityCanvasStore";
import FormatBar from "@/components/editor/FormatBar";
import { reflow } from "@/engine/reflow";
import { TipTapOverlay } from "@/components/editor/TipTapOverlay";
import { VirtualizedPage } from "@/components/editor/VirtualizedPage";
import { FindReplaceBar } from "@/components/editor/FindReplaceBar";
import { useFindReplaceStore } from "@/store/useFindReplaceStore";
import { useCollaboration } from "@/hooks/useCollaboration";
import { CommentSidebar, type EditorComment } from "@/components/editor/CommentSidebar";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type FidelityCanvasProps = {
  documentId: string;
  model: DocumentModel;
  onModelChange?: (model: DocumentModel) => void;
};

const DEFAULT_PAGE = { page_index: 0, width: 595.28, height: 841.89 };

// ── Fabric object factory ─────────────────────────────────────────────────────

function createTextBlock(block: DocumentBlock, scale: number) {
  const bbox = block.bounding_box ?? [72, 72, 540, 86];
  const fm = (block.font_meta ?? {}) as Partial<{
    family: string;
    size: number;
    is_bold: boolean;
    is_italic: boolean;
    color: string;
  }>;
  const left = bbox[0] * scale;
  const top = bbox[1] * scale;
  const width = Math.max((bbox[2] - bbox[0]) * scale, 20);
  const fontSize = Math.max(((fm.size as number) || 11) * scale, 8);

  const tb = new Textbox(block.content || "", {
    left,
    top,
    width,
    fontSize,
    fontFamily: (fm.family as string) || "Georgia, serif",
    fontWeight: (fm.is_bold as boolean) ? "bold" : "normal",
    fontStyle: (fm.is_italic as boolean) ? "italic" : "normal",
    fill: (fm.color as string) || "#111111",
    textAlign: (block.alignment ?? "left") as "left" | "center" | "right" | "justify",
    editable: true,
    splitByGrapheme: false,
    lineHeight: 1.25,
    padding: 2,
    borderColor: "#f97316",
    cornerColor: "#f97316",
    cornerSize: 8,
    transparentCorners: false,
    hasBorders: true,
  });
  (tb as any).data = { blockId: block.id, blockType: block.type };
  return tb;
}

function createTableBlock(block: DocumentBlock, scale: number): Group {
  const tableData = (block as any).table_data ?? { headers: [], rows: [] };
  const bbox = block.bounding_box ?? [72, 72, 400, 200];
  const left = bbox[0] * scale;
  const top = bbox[1] * scale;
  const tableW = Math.max((bbox[2] - bbox[0]) * scale, 80);
  const tableH = Math.max((bbox[3] - bbox[1]) * scale, 40);

  const allRows: string[][] = tableData.headers?.length > 0
    ? [tableData.headers, ...(tableData.rows ?? [])]
    : (tableData.rows ?? []);

  const numCols = Math.max(...allRows.map((r: string[]) => r.length), 1);
  const numRows = Math.max(allRows.length, 1);
  const cellW = tableW / numCols;
  const cellH = tableH / numRows;

  const objects: (Rect | IText)[] = [];

  // Table background
  objects.push(new Rect({ left: 0, top: 0, width: tableW, height: tableH, fill: "#f8fafc", stroke: "#64748b", strokeWidth: 1.5 }));

  allRows.forEach((row: string[], rowIdx: number) => {
    const isHeader = rowIdx === 0 && tableData.headers?.length > 0;
    row.forEach((cell: string, colIdx: number) => {
      const cx = colIdx * cellW;
      const cy = rowIdx * cellH;
      objects.push(new Rect({
        left: cx, top: cy,
        width: cellW, height: cellH,
        fill: isHeader ? "#e2e8f0" : "transparent",
        stroke: "#94a3b8", strokeWidth: 0.75,
      }));
      if (cell) {
        objects.push(new IText(cell, {
          left: cx + 3, top: cy + Math.max(cellH / 2 - 6, 2),
          fontSize: Math.max(8 * scale, 6),
          fontFamily: "Georgia, serif",
          fontWeight: isHeader ? "bold" : "normal",
          fill: "#111827",
          selectable: false,
          evented: false,
        }));
      }
    });
  });

  const group = new Group(objects as any, {
    left, top,
    selectable: true,
    hasControls: true,
    borderColor: "#f97316",
    cornerColor: "#f97316",
    cornerSize: 8,
    transparentCorners: false,
  });
  (group as any).data = { blockId: block.id, blockType: "table", table_data: tableData };
  return group;
}

function createShapeBlock(block: DocumentBlock, scale: number) {
  const fabricData = (block as any).fabric_data ?? {};
  const bbox = block.bounding_box ?? [72, 72, 140, 120];
  const left = bbox[0] * scale;
  const top = bbox[1] * scale;
  const objType = String(fabricData.type || "rect").toLowerCase();
  const stroke = String(fabricData.stroke || "#111111");
  const fill = String(fabricData.fill || "rgba(0,0,0,0)");
  const strokeWidth = Number(fabricData.strokeWidth || 2);

  let shape;
  if (objType === "ellipse" || objType === "circle") {
    shape = new Ellipse({
      left, top,
      rx: Math.max((bbox[2] - bbox[0]) * scale * 0.5, 8),
      ry: Math.max((bbox[3] - bbox[1]) * scale * 0.5, 8),
      stroke, fill, strokeWidth,
    });
  } else if (objType === "line" || objType === "arrow") {
    shape = new Line([left, top, bbox[2] * scale, bbox[3] * scale], { stroke, strokeWidth });
  } else if (["textbox", "text", "i-text", "sticky-note", "sticky_note"].includes(objType)) {
    shape = new IText(String(fabricData.text || block.content || "Text"), {
      left, top,
      fill: String(fabricData.textColor || stroke),
      fontSize: Number(fabricData.fontSize || 18),
      fontFamily: String(fabricData.fontFamily || "Georgia"),
      backgroundColor: objType.includes("sticky") ? String(fabricData.noteFill || "#fff59d") : undefined,
    });
  } else {
    shape = new Rect({
      left, top,
      width: Math.max((bbox[2] - bbox[0]) * scale, 20),
      height: Math.max((bbox[3] - bbox[1]) * scale, 20),
      stroke, fill, strokeWidth,
    });
  }
  (shape as any).data = { blockId: block.id, blockType: "shape", shapeType: objType, ...fabricData };
  return shape;
}

function renderCommentIndicators(
  canvas: Canvas,
  comments: EditorComment[],
  pageIndex: number,
  scale: number,
  onOpenThread: (threadKey: string) => void,
) {
  const existing = canvas.getObjects().filter((o) => (o as any).data?.isCommentIndicator);
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
    (circle as any).data = { isCommentIndicator: true, blockId: key, commentIds: group.map((c) => c.id) };
    circle.on("mousedown", () => onOpenThread(key));
    canvas.add(circle);
  }
  canvas.renderAll();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FidelityCanvas({ documentId, model, onModelChange }: FidelityCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const fabricCanvasesRef = useRef<Map<number, Canvas>>(new Map());
  const saveMutation = useSaveDocumentMutation(documentId);
  const currentModelRef = useRef(model);
  const [activeTipTapBlock, setActiveTipTapBlock] = useState<{ blockId: string; pageIndex: number } | null>(null);
  const [comments, setComments] = useState<EditorComment[]>([]);
  const commentsRef = useRef<EditorComment[]>([]);
  const [openCommentThread, setOpenCommentThread] = useState<string | null>(null);
  const [awarenessUsers, setAwarenessUsers] = useState<Array<{ id: string; name: string; color: string; selectedBlockId?: string | null }>>([]);

  const { activeTool, setActiveTool, setSelectedBlock, pendingFormat, clearPendingFormat } = useFidelityCanvasStore();
  const { matches, currentMatchIndex } = useFindReplaceStore();
  const { ydocRef, providerRef } = useCollaboration(documentId, model);

  useEffect(() => {
    currentModelRef.current = model;
  }, [model]);

  commentsRef.current = comments;

  // Undo / redo kept local — large model snapshots, component-scoped
  const [history, setHistory] = useState<DocumentModel[]>([]);
  const [redoStack, setRedoStack] = useState<DocumentModel[]>([]);

  const pushToHistory = (nextModel: DocumentModel) => {
    setHistory((prev) => [...prev.slice(-49), model]);
    setRedoStack([]);
    onModelChange?.(nextModel);
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [model, ...r]);
    setHistory((h) => h.slice(0, -1));
    onModelChange?.(prev);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory((h) => [...h, model]);
    setRedoStack((r) => r.slice(1));
    onModelChange?.(next);
  };

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isEditing) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.shiftKey ? redo() : undo();
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        void saveMutation.mutateAsync(model);
        e.preventDefault();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        let deleted = false;
        for (const canvas of fabricCanvasesRef.current.values()) {
          const active = canvas.getActiveObjects();
          if (active.length === 0) continue;
          const editing = active.find((o) => o.type === "textbox" && (o as any).isEditing);
          if (editing) continue;
          canvas.discardActiveObject();
          canvas.remove(...active);
          deleted = true;
        }
        if (deleted) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [model, history, redoStack]);

  // ── Layout ───────────────────────────────────────────────────────────────

  const pageDimensions = model.page_dimensions?.length ? model.page_dimensions : [DEFAULT_PAGE];
  const primaryPage = pageDimensions[0] ?? DEFAULT_PAGE;
  const scale = Math.max(0.4, Math.min(2, containerWidth / primaryPage.width));

  useEffect(() => {
    const update = () => {
      if (rootRef.current) setContainerWidth(rootRef.current.clientWidth - 64);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Debounced save ───────────────────────────────────────────────────────

  const saveDebounced = useRef(
    debounce((m: DocumentModel) => void saveMutation.mutateAsync(m), 700)
  );

  // ── Yjs collaboration bridge (Phase 13) ───────────────────────────────────

  useEffect(() => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;
    const yBlocks = ydoc.getMap<Y.Map<unknown>>("blocks");

    const observer = () => {
      for (const [_, canvas] of fabricCanvasesRef.current.entries()) {
        for (const obj of canvas.getObjects()) {
          const blockId = (obj as any).data?.blockId as string | undefined;
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
  }, [ydocRef, scale]);

  // ── Apply format commands from the FormatBar ─────────────────────────────

  useEffect(() => {
    if (!pendingFormat) return;
    for (const [, canvas] of fabricCanvasesRef.current.entries()) {
      const obj = canvas.getActiveObject();
      if (!obj || obj.type !== "textbox") continue;
      const tb = obj as Textbox;
      if (pendingFormat.fontFamily !== undefined) tb.set("fontFamily", pendingFormat.fontFamily);
      if (pendingFormat.fontSize !== undefined) tb.set("fontSize", pendingFormat.fontSize * scale);
      if (pendingFormat.isBold !== undefined) tb.set("fontWeight", pendingFormat.isBold ? "bold" : "normal");
      if (pendingFormat.isItalic !== undefined) tb.set("fontStyle", pendingFormat.isItalic ? "italic" : "normal");
      if (pendingFormat.color !== undefined) tb.set("fill", pendingFormat.color);
      if (pendingFormat.alignment !== undefined) tb.set("textAlign", pendingFormat.alignment);
      if (pendingFormat.left !== undefined) tb.set("left", pendingFormat.left * scale);
      if (pendingFormat.top !== undefined) tb.set("top", pendingFormat.top * scale);
      if (pendingFormat.width !== undefined) tb.set("width", pendingFormat.width * scale);
      canvas.renderAll();
      // fire a modified event so syncCanvasToModel picks it up
      canvas.fire("object:modified", { target: tb });
      break;
    }
    clearPendingFormat();
  }, [pendingFormat]);

  // ── Sync model changes (e.g. AI edits) into live Fabric objects ──────────

  useEffect(() => {
    for (const [, canvas] of fabricCanvasesRef.current.entries()) {
      for (const obj of canvas.getObjects()) {
        const blockId = (obj as any).data?.blockId;
        if (!blockId || obj.type !== "textbox") continue;
        const block = (model.blocks ?? []).find((b) => b.id === blockId);
        if (block && (obj as Textbox).text !== block.content) {
          (obj as Textbox).set("text", block.content || "");
          canvas.renderAll();
        }
      }
    }
  }, [model.blocks]);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch(`/api/bff/documents/${documentId}/comments`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const data = (await res.json()) as EditorComment[];
        setComments(data);
      } catch {
        setComments([]);
      }
    };
    void run();
  }, [documentId]);

  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;
    const onAwareness = () => {
      const states = Array.from(provider.awareness.getStates().entries());
      const users = states
        .map(([id, state]) => ({
          id: String(id),
          name: String((state as any)?.user?.name ?? "?"),
          color: String((state as any)?.user?.color ?? "#64748b"),
          selectedBlockId: (state as any)?.user?.selectedBlockId ?? null,
        }))
        .filter((u) => u.id !== String(provider.awareness.clientID));
      setAwarenessUsers(users);
    };

    provider.awareness.on("change", onAwareness);
    onAwareness();
    return () => {
      provider.awareness.off("change", onAwareness);
    };
  }, [providerRef]);

  useEffect(() => {
    for (const [, canvas] of fabricCanvasesRef.current.entries()) {
      const highlights = canvas.getObjects().filter((o) => (o as any).data?.isHighlight);
      for (const h of highlights) canvas.remove(h);
    }

    if (!matches.length) return;

    for (const match of matches) {
      const canvas = fabricCanvasesRef.current.get(match.pageIndex);
      if (!canvas) continue;
      const block = model.blocks?.find((b) => b.id === match.blockId);
      if (!block) continue;
      const bbox = block.bounding_box ?? [0, 0, 0, 0];
      const [x0, y0, x1, y1] = bbox;
      const isCurrent =
        matches[currentMatchIndex]?.blockId === match.blockId &&
        matches[currentMatchIndex]?.startOffset === match.startOffset;
      const highlightRect = new Rect({
        left: x0 * scale,
        top: y0 * scale,
        width: (x1 - x0) * scale,
        height: (y1 - y0) * scale,
        fill: isCurrent ? "rgba(249,115,22,0.35)" : "rgba(253,224,71,0.35)",
        selectable: false,
        evented: false,
      });
      (highlightRect as any).data = { isHighlight: true };
      canvas.add(highlightRect);
      canvas.bringObjectToFront(highlightRect);
      canvas.renderAll();
    }
  }, [matches, currentMatchIndex, model.blocks, scale]);

  useEffect(() => {
    for (const [pageIndex, canvas] of fabricCanvasesRef.current.entries()) {
      renderCommentIndicators(canvas, comments, pageIndex, scale, setOpenCommentThread);
    }
  }, [comments, scale]);

  // ── Sync all Fabric objects → model ─────────────────────────────────────

  const syncCanvasToModel = (pageIndex: number, canvas: Canvas) => {
    const updatedBlocks: DocumentBlock[] = canvas.getObjects().map((obj, idx) => {
      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const w = (obj.width ?? 1) * (obj.scaleX ?? 1);
      const h = (obj.height ?? 1) * (obj.scaleY ?? 1);
      const blockId = (obj as any).data?.blockId ?? `blk_canvas_${pageIndex}_${idx}_${Date.now()}`;
      const blockType = (obj as any).data?.blockType ?? "paragraph";
      const bbox: [number, number, number, number] = [
        left / scale,
        top / scale,
        (left + w) / scale,
        (top + h) / scale,
      ];

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
    saveDebounced.current(nextModel);
    currentModelRef.current = nextModel;
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
    const fabricObj = canvas
      .getObjects()
      .find((o) => (o as any).data?.blockId === blockId) as Textbox | undefined;
    if (!fabricObj) return;
    fabricObj.set({ text, opacity: 1, evented: true, selectable: true });
    fabricObj.setCoords();
    canvas.renderAll();
  };

  // ── Selection → store (feeds Phase 3 toolbar) ────────────────────────────

  const handleSelection = (canvas: Canvas) => {
    const obj = canvas.getActiveObject();
    if (!obj) { setSelectedBlock(null); return; }
    const data = (obj as any).data ?? {};
    const left = obj.left ?? 0;
    const top = obj.top ?? 0;
    const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
    const h = (obj.height ?? 0) * (obj.scaleY ?? 1);

    if (obj.type === "textbox") {
      const tb = obj as Textbox;
      setSelectedBlock({
        blockId: data.blockId ?? "",
        blockType: data.blockType ?? "paragraph",
        fontFamily: tb.fontFamily || "Georgia",
        fontSize: (tb.fontSize || 11) / scale,
        isBold: tb.fontWeight === "bold",
        isItalic: tb.fontStyle === "italic",
        color: typeof tb.fill === "string" ? tb.fill : "#111111",
        alignment: (tb.textAlign as string) || "left",
        left: left / scale,
        top: top / scale,
        width: w / scale,
        height: h / scale,
      });
    } else {
      setSelectedBlock(null);
    }
  };

  // ── Dispose canvases on doc change ───────────────────────────────────────

  useEffect(() => {
    for (const [pageIndex, canvas] of fabricCanvasesRef.current.entries()) {
      canvas.dispose();
      fabricCanvasesRef.current.delete(pageIndex);
    }
  }, [documentId]);

  // ── Drawing mode ─────────────────────────────────────────────────────────

  useEffect(() => {
    for (const canvas of fabricCanvasesRef.current.values()) {
      canvas.isDrawingMode = activeTool === "draw";
      if (activeTool === "draw") {
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.width = 2;
        canvas.freeDrawingBrush.color = "#ef4444";
      }
    }
  }, [activeTool]);

  // ── Canvas setup ─────────────────────────────────────────────────────────

  const setupFabricCanvas = (pageIndex: number, el: HTMLCanvasElement, width: number, height: number) => {
    const existing = fabricCanvasesRef.current.get(pageIndex);
    if (existing) {
      existing.setDimensions({ width, height });
      return;
    }

    const fcanvas = new Canvas(el, {
      width,
      height,
      selection: true,
      backgroundColor: "transparent",
    });

    // Load ALL blocks for this page as Fabric objects
    const pageBlocks = (model.blocks ?? [])
      .filter((b) => (b.page_index ?? 0) === pageIndex)
      .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));

    for (const block of pageBlocks) {
      let obj;
      if (block.type === "table") {
        obj = createTableBlock(block, scale);
      } else if (block.type === "shape") {
        obj = createShapeBlock(block, scale);
      } else {
        obj = createTextBlock(block, scale);
      }
      fcanvas.add(obj);
    }

    const sync = debounce(() => syncCanvasToModel(pageIndex, fcanvas), 400);
    const reflowDebounced = debounce((blockId: string) => {
      const sourceModel = currentModelRef.current;
      const reflowed = reflow(sourceModel, blockId, fabricCanvasesRef.current, sourceModel.page_dimensions ?? pageDimensions);
      if (reflowed !== sourceModel) {
        pushToHistory(reflowed);
        saveDebounced.current(reflowed);
        currentModelRef.current = reflowed;
        applyReflowToCanvases(reflowed);
      }
    }, 100);

    fcanvas.on("object:added", sync);
    fcanvas.on("object:modified", (e) => {
      const syncedModel = syncCanvasToModel(pageIndex, fcanvas);
      if (syncedModel) currentModelRef.current = syncedModel;
      if (e.target && ydocRef.current) {
        const blockId = (e.target as any).data?.blockId as string | undefined;
        if (blockId) {
          const yBlocks = ydocRef.current.getMap<Y.Map<unknown>>("blocks");
          const yBlock = yBlocks.get(blockId);
          if (yBlock) {
            const obj = e.target;
            const left = (obj.left ?? 0) / scale;
            const top = (obj.top ?? 0) / scale;
            const w = ((obj.width ?? 0) * (obj.scaleX ?? 1)) / scale;
            const h = ((obj.height ?? 0) * (obj.scaleY ?? 1)) / scale;
            ydocRef.current.transact(() => {
              yBlock.set("bounding_box", [left, top, left + w, top + h]);
              if (obj.type === "textbox") yBlock.set("content", (obj as Textbox).text ?? "");
            });
          }
        }
      }
      if (!e.target || (e.target as any).data?.blockType === "shape") return;
      const blockId = (e.target as any).data?.blockId as string | undefined;
      if (!blockId) return;
      reflowDebounced(blockId);
    });
    fcanvas.on("object:removed", sync);
    fcanvas.on("path:created", sync);
    fcanvas.on("mouse:dblclick", (e) => {
      const target = e.target;
      if (!target) {
        addShape(pageIndex);
        return;
      }
      if (target.type !== "textbox") return;
      const blockId = (target as any).data?.blockId as string | undefined;
      if (!blockId) return;
      target.set({ opacity: 0, evented: false, selectable: false });
      fcanvas.renderAll();
      setActiveTipTapBlock({ blockId, pageIndex });
    });
    fcanvas.on("selection:created", () => {
      handleSelection(fcanvas);
      const obj = fcanvas.getActiveObject();
      const blockId = obj ? (obj as any).data?.blockId : null;
      providerRef.current?.awareness.setLocalStateField("user", {
        ...(providerRef.current?.awareness.getLocalState() as any)?.user,
        selectedBlockId: blockId,
      });
    });
    fcanvas.on("selection:updated", () => {
      handleSelection(fcanvas);
      const obj = fcanvas.getActiveObject();
      const blockId = obj ? (obj as any).data?.blockId : null;
      providerRef.current?.awareness.setLocalStateField("user", {
        ...(providerRef.current?.awareness.getLocalState() as any)?.user,
        selectedBlockId: blockId,
      });
    });
    fcanvas.on("selection:cleared", () => {
      setSelectedBlock(null);
      providerRef.current?.awareness.setLocalStateField("user", {
        ...(providerRef.current?.awareness.getLocalState() as any)?.user,
        selectedBlockId: null,
      });
    });

    fabricCanvasesRef.current.set(pageIndex, fcanvas);

    // Draw any already-loaded comment indicators on this newly live canvas.
    renderCommentIndicators(fcanvas, commentsRef.current, pageIndex, scale, setOpenCommentThread);
  };

  const destroyFabricCanvas = (pageIndex: number) => {
    const existing = fabricCanvasesRef.current.get(pageIndex);
    if (!existing) return;
    existing.dispose();
    fabricCanvasesRef.current.delete(pageIndex);
  };

  // ── Add new shape via toolbar ─────────────────────────────────────────────

  const addShape = (pageIndex: number) => {
    const canvas = fabricCanvasesRef.current.get(pageIndex);
    if (!canvas || activeTool === "select" || activeTool === "draw") return;

    let shape;
    if (activeTool === "rect") {
      shape = new Rect({ left: 70, top: 70, width: 140, height: 90, fill: "rgba(14,165,233,0.12)", stroke: "#0284c7", strokeWidth: 2 });
      (shape as any).data = { blockType: "shape", shapeType: "rect" };
    } else if (activeTool === "roundedRect") {
      shape = new Rect({ left: 80, top: 80, width: 160, height: 96, rx: 16, ry: 16, fill: "rgba(99,102,241,0.12)", stroke: "#4f46e5", strokeWidth: 2 });
      (shape as any).data = { blockType: "shape", shapeType: "rounded-rect" };
    } else if (activeTool === "ellipse") {
      shape = new Ellipse({ left: 90, top: 90, rx: 70, ry: 45, fill: "rgba(34,197,94,0.12)", stroke: "#16a34a", strokeWidth: 2 });
      (shape as any).data = { blockType: "shape", shapeType: "ellipse" };
    } else if (activeTool === "arrow") {
      shape = new Line([120, 120, 290, 220], { stroke: "#dc2626", strokeWidth: 3 });
      (shape as any).data = { blockType: "shape", shapeType: "arrow", arrowHeadLength: 14, arrowHeadAngle: 28 };
    } else if (activeTool === "line") {
      shape = new Line([120, 120, 290, 220], { stroke: "#f97316", strokeWidth: 3 });
      (shape as any).data = { blockType: "shape", shapeType: "line" };
    } else if (activeTool === "sticky") {
      shape = new IText("Sticky note", { left: 120, top: 140, fill: "#3f3f46", fontSize: 16, fontFamily: "Georgia", backgroundColor: "#fff59d" });
      (shape as any).data = { blockType: "shape", shapeType: "sticky-note", noteFill: "#fff59d", textColor: "#3f3f46" };
    } else {
      // activeTool === "text" — add a new text block
      const tb = new Textbox("New text", {
        left: 120, top: 140, width: 300,
        fontSize: 14 * scale,
        fontFamily: "Georgia, serif",
        fill: "#111111",
        editable: true,
        borderColor: "#f97316",
        cornerColor: "#f97316",
        cornerSize: 8,
        transparentCorners: false,
      });
      (tb as any).data = { blockType: "paragraph", shapeType: "textbox" };
      canvas.add(tb);
      canvas.setActiveObject(tb);
      canvas.renderAll();
      return;
    }

    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div ref={rootRef} className="h-full overflow-y-auto bg-[var(--bg-surface)] p-8">

      {/* Toolbar */}
      <div className="mx-auto mb-4 flex w-full max-w-[1200px] items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 shadow-sm sticky top-4 z-40">
        {(["select", "rect", "roundedRect", "ellipse", "line", "arrow", "text", "sticky", "draw"] as ShapeTool[]).map((tool) => (
          <button
            key={tool}
            onClick={() => setActiveTool(tool)}
            className={`rounded px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${
              activeTool === tool
                ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-subtle)]"
            }`}
          >
            {tool}
          </button>
        ))}

        <div className="mx-2 h-6 w-px bg-[var(--border-subtle)] hidden md:block" />

        {activeTool === "sticky" && (
          <div className="flex gap-1 items-center mr-auto">
            {["#fff59d", "#a5d6a7", "#90caf9", "#f48fb1", "#ce93d8"].map((color) => (
              <button
                key={color}
                className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}

        <div className={`${activeTool === "sticky" ? "" : "ml-auto"} flex gap-2 items-center`}>
          <span className="text-[10px] text-[var(--text-tertiary)] hidden sm:inline mr-2 font-mono">⌘Z / ⌘⇧Z</span>
          <button onClick={undo} disabled={history.length === 0} className="px-3 py-1.5 text-[10px] font-bold uppercase text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)] transition-colors">Undo</button>
          <button onClick={redo} disabled={redoStack.length === 0} className="px-3 py-1.5 text-[10px] font-bold uppercase text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)] transition-colors">Redo</button>
          <div className="ml-2 flex -space-x-2">
            {awarenessUsers.slice(0, 5).map((user) => (
              <div
                key={user.id}
                title={user.name}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
                style={{ backgroundColor: user.color }}
              >
                {(user.name || "?")[0]?.toUpperCase()}
              </div>
            ))}
            {awarenessUsers.length > 5 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-400 text-[9px] font-bold text-white">
                +{awarenessUsers.length - 5}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Format Bar — appears when a text block is selected */}
      <FormatBar />
      <FindReplaceBar
        model={model}
        onModelChange={(nextModel) => {
          pushToHistory(nextModel);
          saveDebounced.current(nextModel);
          currentModelRef.current = nextModel;
        }}
      />

      {/* Pages */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8">
        {pageDimensions.map((dim) => (
          <VirtualizedPage
            key={dim.page_index}
            dim={dim}
            scale={scale}
            onCanvasReady={(pageIndex, node) => setupFabricCanvas(pageIndex, node, dim.width * scale, dim.height * scale)}
            onCanvasDestroy={destroyFabricCanvas}
          >
            {activeTipTapBlock?.pageIndex === dim.page_index && (() => {
              const block = model.blocks?.find((b) => b.id === activeTipTapBlock.blockId);
              if (!block) return null;
              return (
                <TipTapOverlay
                  block={block}
                  scale={scale}
                  canvasLeft={0}
                  canvasTop={0}
                  onCommit={(text, richContent) => {
                    const nextBlocks = (currentModelRef.current.blocks ?? []).map((b) => {
                      if (b.id !== activeTipTapBlock.blockId) return b;
                      let nextType = b.type;
                      const rootType = String((richContent as any)?.content?.[0]?.type ?? "");
                      if (rootType === "bulletList") nextType = "bullet_list";
                      if (rootType === "orderedList") nextType = "ordered_list";
                      return { ...b, content: text, rich_content: richContent, type: nextType };
                    });
                    const nextModel = { ...currentModelRef.current, blocks: nextBlocks };
                    restoreFabricTextbox(activeTipTapBlock.blockId, activeTipTapBlock.pageIndex, text);
                    setActiveTipTapBlock(null);
                    pushToHistory(nextModel);
                    saveDebounced.current(nextModel);
                    currentModelRef.current = nextModel;
                    const reflowed = reflow(nextModel, activeTipTapBlock.blockId, fabricCanvasesRef.current, nextModel.page_dimensions ?? pageDimensions);
                    if (reflowed !== nextModel) {
                      pushToHistory(reflowed);
                      saveDebounced.current(reflowed);
                      currentModelRef.current = reflowed;
                      applyReflowToCanvases(reflowed);
                    }
                  }}
                  onCancel={() => {
                    restoreFabricTextbox(activeTipTapBlock.blockId, activeTipTapBlock.pageIndex, block.content ?? "");
                    setActiveTipTapBlock(null);
                  }}
                />
              );
            })()}
          </VirtualizedPage>
        ))}
      </div>

      <CommentSidebar
        openThreadKey={openCommentThread}
        comments={comments}
        onClose={() => setOpenCommentThread(null)}
        onResolveThread={async (commentIds) => {
          const supabase = createSupabaseBrowserClient();
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          await Promise.all(
            commentIds.map((id) =>
              fetch(`/api/bff/documents/${documentId}/comments/${id}/resolve`, {
                method: "PATCH",
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              }),
            ),
          );
          setComments((prev) => prev.map((c) => (commentIds.includes(c.id) ? { ...c, resolved: true } : c)));
        }}
        onAddReply={async (body, parentId) => {
          const supabase = createSupabaseBrowserClient();
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          const anchorComment = comments.find((c) => (c.block_id ?? `page_${c.page_index}`) === openCommentThread);
          if (!anchorComment) return;
          const res = await fetch(`/api/bff/documents/${documentId}/comments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              block_id: anchorComment.block_id ?? null,
              page_index: anchorComment.page_index,
              anchor: null,
              position: anchorComment.position ?? { x: 0, y: 0, width: 0, height: 0 },
              body,
              parent_id: parentId ?? null,
            }),
          });
          if (!res.ok) return;
          const created = (await res.json()) as EditorComment;
          setComments((prev) => [...prev, created]);
        }}
      />
    </div>
  );
}
