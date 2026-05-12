"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import debounce from "lodash/debounce";
import { Canvas, Ellipse, FabricObject, Group, IText, Line, PencilBrush, Rect, Textbox } from "fabric";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import { useSaveDocumentMutation } from "@/hooks/useDocumentQueries";
import { useFidelityCanvasStore, type ShapeTool } from "@/store/useFidelityCanvasStore";
import FormatBar from "@/components/editor/FormatBar";
import { reflow } from "@/engine/reflow";
import { DocumentFlowEditor } from "@/components/editor/DocumentFlowEditor";
import { VirtualizedPage } from "@/components/editor/VirtualizedPage";
import { FindReplaceBar } from "@/components/editor/FindReplaceBar";
import { useFindReplaceStore } from "@/store/useFindReplaceStore";
import { useCollaboration } from "@/hooks/useCollaboration";
import { useCollaborationBridge } from "@/hooks/useCollaborationBridge";
import { CommentSidebar, type EditorComment } from "@/components/editor/CommentSidebar";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { SMART_STYLE_PRESETS, applySmartStyle } from "@/engine/styles";
import { PageErrorBoundary } from "@/components/editor/PageErrorBoundary";
import { ShortcutMap } from "@/components/editor/ShortcutMap";
import { trackEdit } from "@/lib/analytics";
import { useCommentIndicators, renderCommentIndicators } from "@/hooks/useCommentIndicators";
import { useDarkModeCanvas } from "@/hooks/useDarkModeCanvas";
import { useAiTools } from "@/hooks/useAiTools";
import { useEditorToolbarActions } from "@/hooks/useEditorToolbarActions";
import { useModelSyncAndReflow } from "@/hooks/useModelSyncAndReflow";
import type { FabricObjectWithMeta, FabricGestureEvent, FabricMouseEvent, AwarenessState, TableData } from "@/types/editor";

type FidelityCanvasProps = {
  documentId: string;
  model: DocumentModel;
  onModelChange?: (model: DocumentModel) => void;
};

type ChangeRecord = {
  id: string;
  blockId: string;
  field: "content" | "bounding_box" | "font_meta" | "alignment";
  oldValue: unknown;
  newValue: unknown;
  userId: string;
  userName: string;
  timestamp: number;
  status: "pending" | "accepted" | "rejected";
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
  (tb as FabricObjectWithMeta).data = { blockId: block.id, blockType: block.type };
  return tb;
}

function createTableBlock(block: DocumentBlock, scale: number): Group {
  const tableData = (block.table_data ?? { headers: [], rows: [] }) as TableData;
  const bbox = block.bounding_box ?? [72, 72, 400, 200];
  const left = bbox[0] * scale;
  const top = bbox[1] * scale;
  const tableW = Math.max((bbox[2] - bbox[0]) * scale, 80);
  const tableH = Math.max((bbox[3] - bbox[1]) * scale, 40);

  const headers = tableData.headers ?? [];
  const allRows: string[][] = headers.length > 0
    ? [headers, ...(tableData.rows ?? [])]
    : (tableData.rows ?? []);

  const numCols = Math.max(...allRows.map((r: string[]) => r.length), 1);
  const numRows = Math.max(allRows.length, 1);
  const cellW = tableW / numCols;
  const cellH = tableH / numRows;

  const objects: (Rect | IText)[] = [];

  // Table background
  objects.push(new Rect({ left: 0, top: 0, width: tableW, height: tableH, fill: "#f8fafc", stroke: "#64748b", strokeWidth: 1.5 }));

  allRows.forEach((row: string[], rowIdx: number) => {
    const isHeader = rowIdx === 0 && headers.length > 0;
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

  const group = new Group(objects as FabricObject[], {
    left, top,
    selectable: true,
    hasControls: true,
    borderColor: "#f97316",
    cornerColor: "#f97316",
    cornerSize: 8,
    transparentCorners: false,
  });
  (group as FabricObjectWithMeta).data = { blockId: block.id, blockType: "table", table_data: tableData };
  return group;
}

function createShapeBlock(block: DocumentBlock, scale: number) {
  const fabricData = block.fabric_data ?? {};
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
  (shape as FabricObjectWithMeta).data = { blockId: block.id, blockType: "shape", shapeType: objType, ...fabricData };
  return shape;
}

function createFieldBlock(block: DocumentBlock, scale: number): Rect {
  const bbox = block.bounding_box ?? [72, 72, 240, 100];
  const x0 = bbox[0];
  const y0 = bbox[1];
  const x1 = bbox[2];
  const y1 = bbox[3];
  const w = (x1 - x0) * scale;
  const h = Math.max((y1 - y0) * scale, 24);

  const fieldRect = new Rect({
    left: x0 * scale,
    top: y0 * scale,
    width: w,
    height: h,
    fill: "rgba(249,115,22,0.06)",
    stroke: "#f97316",
    strokeWidth: 1.5,
    strokeDashArray: [4, 2],
    rx: 4,
    ry: 4,
    selectable: true,
  });
  (fieldRect as FabricObjectWithMeta).data = {
    blockId: block.id,
    blockType: "field",
    fieldType: block.field_type ?? "text",
  };
  return fieldRect;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FidelityCanvas({ documentId, model, onModelChange }: FidelityCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const containerWidthRef = useRef(900);
  const fabricCanvasesRef = useRef<Map<number, Canvas>>(new Map());
  const saveMutation = useSaveDocumentMutation(documentId);
  const currentModelRef = useRef(model);
  type DocumentEditState = { pageIndex: number; blockId: string; cursorTarget: "start" | "end" };
  const [documentEdit, setDocumentEdit] = useState<DocumentEditState | null>(null);
  const [comments, setComments] = useState<EditorComment[]>([]);
  const [openCommentThread, setOpenCommentThread] = useState<string | null>(null);
  const [awarenessUsers, setAwarenessUsers] = useState<Array<{ id: string; name: string; color: string; selectedBlockId?: string | null }>>([]);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Store destructure must precede suggestModeRef — suggestMode is a const binding.
  const { activeTool, setActiveTool, selectedBlock, setSelectedBlock, pendingFormat, clearPendingFormat, suggestMode, toggleSuggestMode, formMode, toggleFormMode } = useFidelityCanvasStore();
  const suggestModeRef = useRef(suggestMode);
  const { matches, currentMatchIndex } = useFindReplaceStore();
  const { ydocRef, providerRef } = useCollaboration(documentId, model);

  useEffect(() => {
    currentModelRef.current = model;
  }, [model]);

  useEffect(() => {
    suggestModeRef.current = suggestMode;
  }, [suggestMode]);

  const saveDebounced = useRef(
    debounce((m: DocumentModel) => void saveMutation.mutateAsync(m), 700)
  );
  const saveModel = (nextModel: DocumentModel) => {
    saveDebounced.current(nextModel);
  };

  const { history, redoStack, pushToHistory, undo, redo, saveVersionSnapshot, convertBlockToField } = useEditorToolbarActions({
    model,
    onModelChange,
    getCurrentModel: () => currentModelRef.current,
    setCurrentModel: (m) => {
      currentModelRef.current = m;
    },
    saveModel,
    documentId,
  });

  const captureChange = (change: Omit<ChangeRecord, "id" | "timestamp" | "status" | "userId" | "userName">) => {
    setChanges((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        userId: "local-user",
        userName: "You",
        timestamp: Date.now(),
        status: "pending",
        ...change,
      },
    ]);
  };

  const acceptChange = (change: ChangeRecord) => {
    const blocks = (currentModelRef.current.blocks ?? []).map((b) => {
      if (b.id !== change.blockId) return b;
      return { ...b, [change.field]: change.newValue } as DocumentBlock;
    });
    const nextModel = { ...currentModelRef.current, blocks };
    pushToHistory(nextModel);
    saveDebounced.current(nextModel);
    currentModelRef.current = nextModel;
    setChanges((prev) => prev.map((c) => (c.id === change.id ? { ...c, status: "accepted" } : c)));
  };

  const rejectChange = (change: ChangeRecord) => {
    // Restore the Fabric object to its pre-change value so the canvas
    // visually reflects the rejection (model was never mutated in suggest mode).
    for (const [, canvas] of fabricCanvasesRef.current.entries()) {
      const obj = canvas.getObjects().find((o) => (o as FabricObjectWithMeta).data?.blockId === change.blockId);
      if (!obj) continue;
      if (change.field === "bounding_box" && Array.isArray(change.oldValue) && change.oldValue.length === 4) {
        const [x0, y0] = change.oldValue as number[];
        obj.set({ left: x0 * scale, top: y0 * scale });
        obj.setCoords();
      }
      if (change.field === "content" && obj.type === "textbox") {
        (obj as Textbox).set("text", String(change.oldValue ?? ""));
      }
      canvas.renderAll();
      break;
    }
    setChanges((prev) => prev.map((c) => (c.id === change.id ? { ...c, status: "rejected" } : c)));
  };


  const addPendingChange = (change: ChangeRecord) => {
    setChanges((prev) => [...prev, change]);
  };
  const { aiSummary, aiRewrite, triggerOcrVerify, summariseDoc } = useAiTools(
    documentId,
    () => currentModelRef.current.blocks ?? [],
    addPendingChange,
  );


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
          const editing = active.find((o) => o.type === "textbox" && (o as IText).isEditing);
          if (editing) continue;
          canvas.discardActiveObject();
          canvas.remove(...active);
          deleted = true;
        }
        if (deleted) e.preventDefault();
      }
      if (e.key === "?") {
        setShowShortcuts((v) => !v);
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
      if (rootRef.current) {
        const w = rootRef.current.clientWidth - 64;
        setContainerWidth(w);
        containerWidthRef.current = w;
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useCollaborationBridge(ydocRef, fabricCanvasesRef, scale, saveDebounced);

  // ── Apply format commands from the FormatBar ─────────────────────────────

  useEffect(() => {
    if (!pendingFormat) return;
    // DocumentFlowEditor's BlockCell handles pendingFormat when active
    if (documentEdit) return;
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
        const blockId = (obj as FabricObjectWithMeta).data?.blockId;
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
      const states = Array.from(provider.awareness.getStates().entries()) as [number, AwarenessState][];
      const users = states
        .map(([id, state]) => ({
          id: String(id),
          name: state.user?.name ?? "?",
          color: state.user?.color ?? "#64748b",
          selectedBlockId: state.user?.selectedBlockId ?? null,
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
      const highlights = canvas.getObjects().filter((o) => (o as FabricObjectWithMeta).data?.isHighlight);
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
      (highlightRect as FabricObjectWithMeta).data = { isHighlight: true };
      canvas.add(highlightRect);
      canvas.bringObjectToFront(highlightRect);
      canvas.renderAll();
    }
  }, [matches, currentMatchIndex, model.blocks, scale]);

  useCommentIndicators(fabricCanvasesRef, comments, scale, setOpenCommentThread);

  const { syncCanvasToModel, applyReflowToCanvases } = useModelSyncAndReflow({
    model,
    scale,
    fabricCanvasesRef,
    setCurrentModel: (m) => {
      currentModelRef.current = m;
    },
    pushToHistory,
    saveModel,
  });

  // ── Selection → store (feeds Phase 3 toolbar) ────────────────────────────

  const handleSelection = (canvas: Canvas) => {
    const obj = canvas.getActiveObject();
    if (!obj) { setSelectedBlock(null); return; }
    const data = (obj as FabricObjectWithMeta).data ?? {};
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

  useDarkModeCanvas(fabricCanvasesRef);

  // ── Canvas setup ─────────────────────────────────────────────────────────

  const setupFabricCanvas = (pageIndex: number, el: HTMLCanvasElement, width: number, height: number) => {
    const existing = fabricCanvasesRef.current.get(pageIndex);
    if (existing) {
      existing.setDimensions({ width, height });
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const fcanvas = new Canvas(el, {
      width,
      height,
      selection: true,
      backgroundColor: prefersDark ? "#1e1e1e" : "transparent",
    });

    // Load ALL blocks for this page as Fabric objects
    const pageBlocks = (model.blocks ?? [])
      .filter((b) => (b.page_index ?? 0) === pageIndex)
      .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));

    for (const block of pageBlocks) {
      let obj;
      if (block.type === "table") {
        obj = createTableBlock(block, scale);
      } else if (block.type === "field") {
        obj = createFieldBlock(block, scale);
      } else if (block.type === "shape") {
        obj = createShapeBlock(block, scale);
      } else {
        obj = createTextBlock(block, scale);
      }
      fcanvas.add(obj);

      if ((block.confidence_score ?? 1) < 0.9) {
        const bbox = block.bounding_box ?? [0, 0, 0, 0];
        const badge = new IText("!", {
          left: bbox[2] * scale + 2,
          top: bbox[1] * scale,
          fontSize: 10,
          fill: "#f59e0b",
          selectable: false,
          evented: true,
          hoverCursor: "pointer",
        });
        (badge as FabricObjectWithMeta).data = { isOcrBadge: true, blockId: block.id };
        badge.on("mousedown", () => {
          void triggerOcrVerify(block.id);
        });
        fcanvas.add(badge);
      }
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
      if (suggestModeRef.current && e.target) {
        const blockId = (e.target as FabricObjectWithMeta).data?.blockId;
        if (blockId) {
          const existing = (currentModelRef.current.blocks ?? []).find((b) => b.id === blockId);
          if (existing) {
            const obj = e.target;
            const left = (obj.left ?? 0) / scale;
            const top = (obj.top ?? 0) / scale;
            const w = ((obj.width ?? 0) * (obj.scaleX ?? 1)) / scale;
            const h = ((obj.height ?? 0) * (obj.scaleY ?? 1)) / scale;
            captureChange({
              blockId,
              field: "bounding_box",
              oldValue: existing.bounding_box,
              newValue: [left, top, left + w, top + h],
            });
            if (obj.type === "textbox") {
              captureChange({
                blockId,
                field: "content",
                oldValue: existing.content ?? "",
                newValue: (obj as Textbox).text ?? "",
              });
            }
          }
        }
      } else {
        const syncedModel = syncCanvasToModel(pageIndex, fcanvas);
        if (syncedModel) currentModelRef.current = syncedModel;
      }
      // In suggest mode changes are captured, not committed — skip Yjs and reflow.
      if (suggestModeRef.current) return;
      if (e.target && ydocRef.current) {
        const blockId = (e.target as FabricObjectWithMeta).data?.blockId;
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
      if (!e.target || (e.target as FabricObjectWithMeta).data?.blockType === "shape") return;
      const blockId = (e.target as FabricObjectWithMeta).data?.blockId;
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
      const blockId = (target as FabricObjectWithMeta).data?.blockId;
      if (!blockId) return;
      // Hide all textboxes on this page — DocumentFlowEditor overlays them all
      for (const obj of fcanvas.getObjects()) {
        if (obj.type === "textbox") {
          obj.set({ opacity: 0, evented: false, selectable: false });
        }
      }
      fcanvas.renderAll();
      setDocumentEdit({ pageIndex, blockId, cursorTarget: "end" });
    });
    fcanvas.on("mouse:down", (e) => {
      const raw = (e as unknown as FabricMouseEvent).e;
      if (!(raw instanceof MouseEvent) || raw.button !== 2) return;
      const target = e.target;
      if (!target) return;
      raw.preventDefault();
      const blockId = (target as FabricObjectWithMeta).data?.blockId;
      if (!blockId) return;
      const action = window.prompt("AI tools: improve | shorten | formal | casual | ocr", "improve");
      if (!action) return;
      if (action.toLowerCase() === "ocr") {
        void triggerOcrVerify(blockId);
        return;
      }
      void aiRewrite(blockId, action.toLowerCase());
    });
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    // "touch:gesture" is a valid Fabric event but absent from the v6 CanvasEvents typemap.
    (fcanvas as unknown as { on(ev: string, fn: (e: unknown) => void): void }).on("touch:gesture", (e) => {
      const gesture = (e as FabricGestureEvent).self;
      if (!gesture || gesture.touches !== 2) return;
      const currentWidth = containerWidthRef.current;
      const currentScale = Math.max(0.4, Math.min(2, currentWidth / primaryPage.width));
      const gestureScale = Number(gesture.scale || 1);
      const next = Math.max(0.3, Math.min(3, currentScale * gestureScale));
      const nextWidth = currentWidth * (next / currentScale);
      containerWidthRef.current = nextWidth;
      setContainerWidth(nextWidth);
    });
    fcanvas.on("mouse:down", () => {
      longPressTimer = setTimeout(() => {
        const obj = fcanvas.getActiveObject();
        const blockId = (obj as FabricObjectWithMeta | undefined)?.data?.blockId ?? null;
        if (blockId) {
          void aiRewrite(blockId, "improve");
        }
      }, 500);
    });
    fcanvas.on("mouse:up", () => {
      if (longPressTimer) clearTimeout(longPressTimer);
    });
    fcanvas.on("selection:created", () => {
      handleSelection(fcanvas);
      const obj = fcanvas.getActiveObject();
      const blockId = (obj as FabricObjectWithMeta | undefined)?.data?.blockId ?? null;
      providerRef.current?.awareness.setLocalStateField("user", {
        ...(providerRef.current?.awareness.getLocalState() as AwarenessState | null)?.user,
        selectedBlockId: blockId,
      });
    });
    fcanvas.on("selection:updated", () => {
      handleSelection(fcanvas);
      const obj = fcanvas.getActiveObject();
      const blockId = (obj as FabricObjectWithMeta | undefined)?.data?.blockId ?? null;
      providerRef.current?.awareness.setLocalStateField("user", {
        ...(providerRef.current?.awareness.getLocalState() as AwarenessState | null)?.user,
        selectedBlockId: blockId,
      });
    });
    fcanvas.on("selection:cleared", () => {
      setSelectedBlock(null);
      providerRef.current?.awareness.setLocalStateField("user", {
        ...(providerRef.current?.awareness.getLocalState() as AwarenessState | null)?.user,
        selectedBlockId: null,
      });
    });

    fabricCanvasesRef.current.set(pageIndex, fcanvas);

    // Apply any already-loaded comment indicators to this newly-live canvas.
    renderCommentIndicators(fcanvas, comments, pageIndex, scale, setOpenCommentThread);
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
      (shape as FabricObjectWithMeta).data = { blockType: "shape", shapeType: "rect" };
    } else if (activeTool === "roundedRect") {
      shape = new Rect({ left: 80, top: 80, width: 160, height: 96, rx: 16, ry: 16, fill: "rgba(99,102,241,0.12)", stroke: "#4f46e5", strokeWidth: 2 });
      (shape as FabricObjectWithMeta).data = { blockType: "shape", shapeType: "rounded-rect" };
    } else if (activeTool === "ellipse") {
      shape = new Ellipse({ left: 90, top: 90, rx: 70, ry: 45, fill: "rgba(34,197,94,0.12)", stroke: "#16a34a", strokeWidth: 2 });
      (shape as FabricObjectWithMeta).data = { blockType: "shape", shapeType: "ellipse" };
    } else if (activeTool === "arrow") {
      shape = new Line([120, 120, 290, 220], { stroke: "#dc2626", strokeWidth: 3 });
      (shape as FabricObjectWithMeta).data = { blockType: "shape", shapeType: "arrow", arrowHeadLength: 14, arrowHeadAngle: 28 };
    } else if (activeTool === "line") {
      shape = new Line([120, 120, 290, 220], { stroke: "#f97316", strokeWidth: 3 });
      (shape as FabricObjectWithMeta).data = { blockType: "shape", shapeType: "line" };
    } else if (activeTool === "sticky") {
      shape = new IText("Sticky note", { left: 120, top: 140, fill: "#3f3f46", fontSize: 16, fontFamily: "Georgia", backgroundColor: "#fff59d" });
      (shape as FabricObjectWithMeta).data = { blockType: "shape", shapeType: "sticky-note", noteFill: "#fff59d", textColor: "#3f3f46" };
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
      (tb as FabricObjectWithMeta).data = { blockType: "paragraph", shapeType: "textbox" };
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
    <div ref={rootRef} className="h-full overflow-auto bg-[var(--bg-surface)] p-4 md:p-6 xl:p-8">

      {/* Toolbar */}
      <div className="sticky top-4 z-40 mx-auto mb-4 flex w-full min-w-[760px] max-w-[1200px] items-center gap-2 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 shadow-sm">
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

        <button
          onClick={() => {
            toggleSuggestMode();
            trackEdit("suggest_mode_toggled", { enabled: !suggestMode });
          }}
          className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase ${suggestMode ? "bg-amber-500 text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-glass-subtle)]"}`}
        >
          Suggest {suggestMode ? "On" : "Off"}
        </button>

        <button
          onClick={() => {
            toggleFormMode();
            trackEdit("form_mode_toggled", { enabled: !formMode });
          }}
          className={`rounded px-3 py-1.5 text-[10px] font-bold uppercase ${formMode ? "bg-orange-500 text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-glass-subtle)]"}`}
        >
          Form {formMode ? "On" : "Off"}
        </button>

        <button
          onClick={() => {
            if (!selectedBlock?.blockId || !formMode) return;
            convertBlockToField(selectedBlock.blockId, "text");
          }}
          className="rounded px-3 py-1.5 text-[10px] font-bold uppercase text-[var(--text-secondary)] hover:bg-[var(--bg-glass-subtle)]"
        >
          To Field
        </button>

        <button
          onClick={() => {
            void summariseDoc();
          }}
          className="rounded px-3 py-1.5 text-[10px] font-bold uppercase text-[var(--text-secondary)] hover:bg-[var(--bg-glass-subtle)]"
        >
          Summarise
        </button>

        <button
          onClick={() => {
            void saveVersionSnapshot();
          }}
          className="rounded px-3 py-1.5 text-[10px] font-bold uppercase text-[var(--text-secondary)] hover:bg-[var(--bg-glass-subtle)]"
        >
          Save Version
        </button>

        <select
          className="rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-[10px]"
          defaultValue=""
          onChange={(e) => {
            const preset = SMART_STYLE_PRESETS.find((p) => p.id === e.target.value);
            if (!preset) return;
            const nextModel = applySmartStyle(currentModelRef.current, preset);
            pushToHistory(nextModel);
            saveDebounced.current(nextModel);
            currentModelRef.current = nextModel;
            trackEdit("style_applied", { style: preset.id });
            e.currentTarget.value = "";
          }}
        >
          <option value="" disabled>Smart Style</option>
          {SMART_STYLE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.label}</option>
          ))}
        </select>

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
      {aiSummary && (
        <div className="mx-auto mb-3 w-full max-w-[1200px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <span className="mr-2 font-bold text-[var(--text-primary)]">AI Summary:</span>
          {aiSummary}
        </div>
      )}

      {/* Pages */}
      {/* eslint-disable-next-line react-hooks/refs -- pageDimensions is state derived, not a ref */}
      <div className="mx-auto flex w-full min-w-[760px] max-w-[1200px] flex-col gap-8">
        {pageDimensions.map((dim) => (
          <PageErrorBoundary key={dim.page_index} pageIndex={dim.page_index}>
            <VirtualizedPage
              dim={dim}
              scale={scale}
              onCanvasReady={(pageIndex, node) => setupFabricCanvas(pageIndex, node, dim.width * scale, dim.height * scale)}
              onCanvasDestroy={destroyFabricCanvas}
            >
              {documentEdit?.pageIndex === dim.page_index && (() => {
                const pageBlocks = (model.blocks ?? []).filter(
                  (b) => (b.page_index ?? 0) === dim.page_index && b.type !== "shape",
                );
                return (
                  <DocumentFlowEditor
                    blocks={pageBlocks}
                    allBlocks={model.blocks ?? []}
                    scale={scale}
                    initialBlockId={documentEdit.blockId}
                    cursorTarget={documentEdit.cursorTarget}
                    onCommit={(updatedBlocks, deletedIds) => {
                      const deletedSet = new Set(deletedIds);
                      const nextBlocks = (currentModelRef.current.blocks ?? [])
                        .filter((b) => !deletedSet.has(b.id))
                        .map((b) => {
                          const updated = updatedBlocks.find((u) => u.id === b.id);
                          return updated ?? b;
                        });
                      const nextModel = { ...currentModelRef.current, blocks: nextBlocks };
                      pushToHistory(nextModel);
                      saveDebounced.current(nextModel);
                      currentModelRef.current = nextModel;
                      // Restore Fabric textboxes with updated content
                      const canvas = fabricCanvasesRef.current.get(dim.page_index);
                      if (canvas) {
                        for (const obj of canvas.getObjects()) {
                          if (obj.type !== "textbox") continue;
                          const blockId = (obj as FabricObjectWithMeta & { data?: { blockId?: string } }).data?.blockId;
                          const updated = nextBlocks.find((b) => b.id === blockId);
                          if (updated) (obj as Textbox).set("text", updated.content || "");
                          obj.set({ opacity: 1, evented: true, selectable: true });
                        }
                        canvas.renderAll();
                      }
                      // Reflow the whole page
                      const firstChanged = updatedBlocks[0]?.id;
                      if (firstChanged) {
                        const reflowed = reflow(nextModel, firstChanged, fabricCanvasesRef.current, nextModel.page_dimensions ?? pageDimensions);
                        if (reflowed !== nextModel) {
                          pushToHistory(reflowed);
                          saveDebounced.current(reflowed);
                          currentModelRef.current = reflowed;
                          applyReflowToCanvases(reflowed);
                        }
                      }
                    }}
                    onNavigateToPage={(targetPage, blockId, cursorTgt) => {
                      // Restore current page textboxes before switching
                      const canvas = fabricCanvasesRef.current.get(dim.page_index);
                      if (canvas) {
                        for (const obj of canvas.getObjects()) {
                          if (obj.type === "textbox") obj.set({ opacity: 1, evented: true, selectable: true });
                        }
                        canvas.renderAll();
                      }
                      // Hide textboxes on target page
                      const targetCanvas = fabricCanvasesRef.current.get(targetPage);
                      if (targetCanvas) {
                        for (const obj of targetCanvas.getObjects()) {
                          if (obj.type === "textbox") obj.set({ opacity: 0, evented: false, selectable: false });
                        }
                        targetCanvas.renderAll();
                      }
                      setDocumentEdit({ pageIndex: targetPage, blockId, cursorTarget: cursorTgt });
                    }}
                    onClose={() => {
                      setSelectedBlock(null);
                      const canvas = fabricCanvasesRef.current.get(dim.page_index);
                      if (canvas) {
                        for (const obj of canvas.getObjects()) {
                          if (obj.type === "textbox") obj.set({ opacity: 1, evented: true, selectable: true });
                        }
                        canvas.renderAll();
                      }
                      setDocumentEdit(null);
                    }}
                  />
                );
              })()}
              <div className="sr-only" aria-label={`Page ${dim.page_index + 1} content`}>
                {(model.blocks ?? [])
                  .filter((b) => (b.page_index ?? 0) === dim.page_index)
                  .map((block) => (
                    <div
                      key={block.id}
                      role={String(block.type).startsWith("heading") ? "heading" : undefined}
                      aria-level={block.type === "heading1" ? 1 : block.type === "heading2" ? 2 : block.type === "heading3" ? 3 : undefined}
                      tabIndex={0}
                    >
                      {block.content}
                    </div>
                  ))}
              </div>
            </VirtualizedPage>
          </PageErrorBoundary>
        ))}
      </div>

      <ShortcutMap open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {suggestMode && changes.filter((c) => c.status === "pending").length > 0 && (
        <div className="fixed bottom-4 left-4 z-50 w-[360px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 shadow-xl">
          <div className="mb-2 text-xs font-bold uppercase text-[var(--text-secondary)]">Pending Changes</div>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {changes.filter((c) => c.status === "pending").map((change) => (
              <div key={change.id} className="rounded border border-[var(--border-subtle)] p-2">
                <div className="text-[11px] text-[var(--text-primary)]">{change.field} on {change.blockId.slice(0, 8)}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => acceptChange(change)} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">Accept</button>
                  <button onClick={() => rejectChange(change)} className="rounded bg-rose-600 px-2 py-1 text-[10px] font-bold text-white">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
