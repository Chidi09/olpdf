"use client";

import React, { useEffect, useRef, useState, useCallback, useReducer } from "react";
import { createPortal } from "react-dom";
import {
  CursorArrowRaysIcon,
  StopIcon,
  RectangleGroupIcon,
  EllipsisHorizontalCircleIcon,
  MinusIcon,
  ArrowLongRightIcon,
  PencilSquareIcon,
  ClipboardDocumentIcon,
  PencilIcon,
  LightBulbIcon,
  ClipboardDocumentCheckIcon,
  Squares2X2Icon,
  SparklesIcon,
  BookmarkIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  EllipsisHorizontalIcon,
  PhotoIcon,
  TableCellsIcon,
  VariableIcon,
  ChatBubbleLeftRightIcon,
  SunIcon,
  DocumentTextIcon,
  HashtagIcon,
} from "@heroicons/react/24/outline";
import { GlassTooltip } from "@/components/ui/GlassTooltip";
import * as Y from "yjs";
import debounce from "lodash/debounce";
import { Canvas, Ellipse, FabricObject, Group, IText, Line, PencilBrush, Rect, Textbox, FabricImage } from "fabric";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import { useSaveDocumentMutation } from "@/hooks/useDocumentQueries";
import { useFidelityCanvasStore, type ShapeTool } from "@/store/useFidelityCanvasStore";
import { usePageLayoutStore } from "@/store/usePageLayoutStore";
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
import { rectFromCanvasObjectBounds, documentRectToCanvasRect, type RectX0Y0X1Y1 } from "@/lib/geometry/rect";
import type { LayoutObject } from "@/types/pageLayout";
import { fabricSpecFromLayoutObject, createFabricObject } from "@/components/editor/pageLayoutFabric";
import { createDefaultTableFrame } from "@/lib/pageLayout/table";
import { createShapeFrame, createSymbolFrame, COMMON_SYMBOLS } from "@/lib/pageLayout/shapes";
import { createHighlightFrame, createCommentFrame, createSignatureFrame } from "@/lib/pageLayout/annotations";
import { usePdfEditOperationsStore } from "@/store/usePdfEditOperationsStore";
import { aiApplyReducer, initialAiApplyState } from "@/components/editor/ai/aiApplyState";
import { resolveAnimationProfile } from "@/components/editor/ai/aiAnimationPolicy";
import AIApplyEffectsLayer from "@/components/editor/ai/AIApplyEffectsLayer";
import AIStatusHelper from "@/components/editor/ai/AIStatusHelper";
import { isOperationValid } from "@/components/editor/ai/tools/validators";
import { pickMinimalOperation } from "@/components/editor/ai/tools/minimalOpPlanner";
import type { ToolOperation } from "@/components/editor/ai/tools/contracts";
import type { PdfEditOperation } from "@/types/nativePdf";
import type { AiApplyAction } from "@/components/editor/ai/aiApplyState";
import type { PageLayoutDocument } from "@/types/pageLayout";
import { reconcileFabricCanvas } from "@/lib/canvas/reconcileFabricCanvas";
import { shouldRenderInlineCanvasToolbar } from "@/components/editor/canvasToolbarPlacement";
import { shouldEditFabricTextInPlace } from "@/components/editor/canvasTextEditing";
import { getActiveToolAfterToolbarClick, shouldInsertToolImmediately } from "@/components/editor/canvasToolBehavior";

type FidelityCanvasProps = {
  documentId: string;
  model: DocumentModel;
  layoutDocument?: PageLayoutDocument;
  toolbarHost?: HTMLElement | null;
  onModelChange?: (model: DocumentModel) => void;
  onNativeOperation?: (operation: PdfEditOperation) => void;
  onAiLifecycleEvent?: (action: AiApplyAction) => void;
  readOnly?: boolean;
  exportRequest?: { requestId: string; format: "pdf" | "docx" } | null;
  onExportComplete?: (result: { requestId: string; url: string }) => void;
  onExportError?: (result: { requestId: string; message: string }) => void;
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
  const [left, top, right, bottom] = documentRectToCanvasRect((block.bounding_box ?? [72, 72, 540, 86]) as RectX0Y0X1Y1, scale);
  const width = Math.max(right - left, 20);
  const fm = (block.font_meta ?? {}) as Partial<{
    family: string;
    size: number;
    is_bold: boolean;
    is_italic: boolean;
    color: string;
  }>;
  const fontSize = Math.max(((fm.size as number) || 11) * scale, 8);

  const tb = new Textbox(block.content || "", {
    left,
    top,
    width,
    fontSize,
    fontFamily: (fm.family as string) || "Georgia, serif",
    fontWeight: (fm.is_bold as boolean) ? "bold" : "normal",
    fontStyle: (fm.is_italic as boolean) ? "italic" : "normal",
    fill: block.is_invisible ? "transparent" : ((fm.color as string) || "#111111"),
    textAlign: (block.alignment ?? "left") as "left" | "center" | "right" | "justify",
    editable: true,
    splitByGrapheme: false,
    lineHeight: 1.25,
    padding: 2,
    backgroundColor: block.is_invisible ? "transparent" : "#ffffff", // Hide the underlying text in the rasterized background PNG
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
  const [left, top, right, bottom] = documentRectToCanvasRect((block.bounding_box ?? [72, 72, 400, 200]) as RectX0Y0X1Y1, scale);
  const tableW = Math.max(right - left, 80);
  const tableH = Math.max(bottom - top, 40);

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
  const [left, top, right, bottom] = documentRectToCanvasRect((block.bounding_box ?? [72, 72, 140, 120]) as RectX0Y0X1Y1, scale);
  const objType = String(fabricData.type || "rect").toLowerCase();
  const stroke = String(fabricData.stroke || "#111111");
  const fill = String(fabricData.fill || "rgba(0,0,0,0)");
  const strokeWidth = Number(fabricData.strokeWidth || 2);

  let shape;
  if (objType === "ellipse" || objType === "circle") {
    shape = new Ellipse({
      left, top,
      rx: Math.max((right - left) * 0.5, 8),
      ry: Math.max((bottom - top) * 0.5, 8),
      stroke, fill, strokeWidth,
    });
  } else if (objType === "line" || objType === "arrow") {
    shape = new Line([left, top, right, bottom], { stroke, strokeWidth });
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
      width: Math.max(right - left, 20),
      height: Math.max(bottom - top, 20),
      stroke, fill, strokeWidth,
    });
  }
  (shape as FabricObjectWithMeta).data = { blockId: block.id, blockType: "shape", shapeType: objType, ...fabricData };
  return shape;
}

function createFieldBlock(block: DocumentBlock, scale: number): Rect {
  const [left, top, right, bottom] = documentRectToCanvasRect((block.bounding_box ?? [72, 72, 240, 100]) as RectX0Y0X1Y1, scale);
  const w = right - left;
  const h = Math.max(bottom - top, 24);

  const fieldRect = new Rect({
    left, top,
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
  (fieldRect as any).data = {
    blockId: block.id,
    blockType: "field",
    fieldType: block.field_type ?? "text",
  };
  return fieldRect;
}

function loadImageBlock(block: DocumentBlock, scale: number, canvas: Canvas) {
  const [left, top, right, bottom] = documentRectToCanvasRect((block.bounding_box ?? [0, 0, 100, 100]) as RectX0Y0X1Y1, scale);
  const w = right - left;
  const h = bottom - top;

  if (block.src) {
    FabricImage.fromURL(block.src, { crossOrigin: "anonymous" }).then((img) => {
      img.set({
        left,
        top,
        scaleX: w / (img.width || 1),
        scaleY: h / (img.height || 1),
      });
      (img as any).data = { blockId: block.id, blockType: "image" };
      canvas.add(img);
      canvas.renderAll();
    }).catch(() => {
      // Fallback placeholder on failure
      const fallback = new Rect({ left, top, width: w, height: h, fill: "rgba(0,0,0,0.1)", stroke: "#ccc" });
      (fallback as any).data = { blockId: block.id, blockType: "image" };
      canvas.add(fallback);
    });
  } else {
    const placeholder = new Rect({ left, top, width: w, height: h, fill: "rgba(0,0,0,0.1)", stroke: "#ccc" });
    (placeholder as any).data = { blockId: block.id, blockType: "image" };
    canvas.add(placeholder);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FidelityCanvas({ documentId, model, layoutDocument, toolbarHost, onModelChange, onNativeOperation, onAiLifecycleEvent, readOnly, exportRequest, onExportComplete, onExportError }: FidelityCanvasProps) {
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
  const [userZoom, setUserZoom] = useState(1.0);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  // pageImages[i] = presigned PNG URL for page i, or undefined while loading
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const lastInteractedPageIndexRef = useRef(0);

  // Store destructure must precede suggestModeRef — suggestMode is a const binding.
  const { activeTool, setActiveTool, selectedBlock, setSelectedBlock, pendingFormat, clearPendingFormat, suggestMode, toggleSuggestMode, formMode, toggleFormMode } = useFidelityCanvasStore();
  const opStore = usePdfEditOperationsStore();
  const suggestModeRef = useRef(suggestMode);
  const { matches, currentMatchIndex } = useFindReplaceStore();
  const { ydocRef, providerRef } = useCollaboration(documentId, model);

  useEffect(() => {
    currentModelRef.current = model;
  }, [model]);

  useEffect(() => {
    suggestModeRef.current = suggestMode;
  }, [suggestMode]);

  // ── Layout ───────────────────────────────────────────────────────────────

  const pageDimensions = model.page_dimensions?.length ? model.page_dimensions : [DEFAULT_PAGE];
  const primaryPage = pageDimensions[0] ?? DEFAULT_PAGE;
  const scale = Math.max(0.4, Math.min(3, (containerWidth / primaryPage.width) * userZoom));

  useEffect(() => {
    const fetchImages = async () => {
      const nextImages = { ...pageImages };
      let changed = false;
      const pagesToFetch = pageDimensions.filter((dim) => !nextImages[dim.page_index]);

      await Promise.all(
        pagesToFetch.map(async (dim) => {
          try {
            const res = await fetch(`/api/bff/documents/${documentId}/page/${dim.page_index}/image`);
            if (res.ok) {
              const data = await res.json();
              if (data.url) {
                nextImages[dim.page_index] = data.url;
                changed = true;
              }
            }
          } catch (e) {
            // best effort
          }
        })
      );
      if (changed) {
        setPageImages(nextImages);
      }
    };
    void fetchImages();
  }, [documentId, pageDimensions]);

  const saveDebounced = useRef(
    debounce((m: DocumentModel) => void saveMutation.mutateAsync(m), 700)
  );
  const saveModel = (nextModel: DocumentModel) => {
    saveDebounced.current(nextModel);
  };

  // ── AI Apply Lifecycle ─────────────────────────────────────────────────
  const [aiState, dispatchAiLocal] = useReducer(aiApplyReducer, initialAiApplyState);
  const dispatchAi = useCallback((action: AiApplyAction) => {
    dispatchAiLocal(action);
    onAiLifecycleEvent?.(action);
  }, [onAiLifecycleEvent]);
  const animationProfile = resolveAnimationProfile({
    changedBlockCount: aiState.changedBlockCount,
    affectedPageCount: aiState.affectedPageCount,
    isReducedMotion: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });

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
    if (readOnly) return;
    const blocks = (currentModelRef.current.blocks ?? []).map((b) => {
      if (b.id !== change.blockId) return b;
      return { ...b, [change.field]: change.newValue } as DocumentBlock;
    });
    const nextModel = { ...currentModelRef.current, blocks };
    pushToHistory(nextModel);
    saveDebounced.current(nextModel);
    currentModelRef.current = nextModel;
    onModelChange?.(nextModel);
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

  const handleAiEdit = useCallback((blocks: DocumentBlock[], operation: ToolOperation) => {
    if (readOnly || !isOperationValid(operation)) return;
    dispatchAi({ type: "START_APPLYING", changedBlockCount: operation.anchor.blockIds.length, affectedPageCount: 1 });
    const nextModel = { ...model, blocks };
    pushToHistory(nextModel);
    saveDebounced.current(nextModel);
    currentModelRef.current = nextModel;
    onModelChange?.(nextModel);
    setTimeout(() => dispatchAi({ type: "FINISH_APPLYING" }), 400);
  }, [model, pushToHistory, onModelChange]);


  // ── Zoom helpers ─────────────────────────────────────────────────────────

  const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];

  const changeZoom = useCallback((delta: "in" | "out" | "reset") => {
    setUserZoom((prev) => {
      if (delta === "reset") return 1.0;
      if (delta === "in") {
        const next = ZOOM_STEPS.find((z) => z > prev + 0.01);
        return next ?? prev;
      }
      const next = [...ZOOM_STEPS].reverse().find((z) => z < prev - 0.01);
      return next ?? prev;
    });
  }, []);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!showOverflowMenu) return;
    const onDown = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showOverflowMenu]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        changeZoom("in");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        changeZoom("out");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        changeZoom("reset");
        return;
      }

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
          // Check if any have layoutObjectId and delete via store
          const layoutIds = active
            .map((o) => {
              const d = (o as FabricObjectWithMeta).data;
              return d?.layoutObjectId ? { id: d.layoutObjectId, pageId: d.pageId } : null;
            })
            .filter(Boolean) as { id: string; pageId: string }[];
          if (layoutIds.length > 0) {
            const store = usePageLayoutStore.getState();
            for (const { id, pageId } of layoutIds) {
              store.deleteObject(pageId, id);
            }
          }
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
  }, [model, history, redoStack, changeZoom]);

  // ── Ctrl/Cmd + scroll to zoom ────────────────────────────────────────────

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      changeZoom(e.deltaY < 0 ? "in" : "out");
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [changeZoom]);

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

  // ── Read-only mode ─────────────────────────────────────────────────────
  useEffect(() => {
    for (const [, canvas] of fabricCanvasesRef.current.entries()) {
      canvas.selection = !readOnly;
      canvas.getObjects().forEach((obj) => { obj.selectable = !readOnly; obj.evented = !readOnly; });
      canvas.renderAll();
    }
  }, [readOnly]);

  // ── Export request ────────────────────────────────────────────────────
  const prevExportRequestRef = useRef(exportRequest);
  useEffect(() => {
    if (!exportRequest || exportRequest === prevExportRequestRef.current) return;
    prevExportRequestRef.current = exportRequest;
    const fetchExport = async () => {
      try {
        const res = await fetch(`/api/bff/documents/${documentId}/export/${exportRequest.format}`, { method: "POST" });
        if (!res.ok) throw new Error(`Export failed: ${res.status}`);
        const data = await res.json() as { url?: string };
        if (data.url) {
          onExportComplete?.({ requestId: exportRequest.requestId, url: data.url });
        }
      } catch (err) {
        onExportError?.({ requestId: exportRequest.requestId, message: err instanceof Error ? err.message : "Unknown export error" });
      }
    };
    void fetchExport();
  }, [exportRequest, documentId, onExportComplete, onExportError]);

  useCollaborationBridge(ydocRef, providerRef, fabricCanvasesRef, scale, saveDebounced);

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
    const nextBlocks = model.blocks ?? [];
    for (const [pageIndex, canvas] of fabricCanvasesRef.current.entries()) {
      const pageBlocks = nextBlocks
        .filter((b) => (b.page_index ?? 0) === pageIndex)
        .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
      reconcileFabricCanvas(canvas, pageIndex, pageBlocks, scale, (block, s) => {
        const btype = (block as any).type ?? "paragraph";
        if (btype === "image") {
          loadImageBlock(block, s, canvas);
          return null;
        }
        if (btype === "table") return createTableBlock(block, s);
        if (btype === "field") return createFieldBlock(block, s);
        if (btype === "shape") return createShapeBlock(block, s);
        return createTextBlock(block, s);
      });
    }
  }, [model.blocks, scale]);

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
      const [hLeft, hTop, hRight, hBottom] = documentRectToCanvasRect((block.bounding_box ?? [0, 0, 0, 0]) as RectX0Y0X1Y1, scale);
      const isCurrent =
        matches[currentMatchIndex]?.blockId === match.blockId &&
        matches[currentMatchIndex]?.startOffset === match.startOffset;
      const highlightRect = new Rect({
        left: hLeft,
        top: hTop,
        width: hRight - hLeft,
        height: hBottom - hTop,
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
      if (existing.getElement() !== el) {
        existing.dispose();
        fabricCanvasesRef.current.delete(pageIndex);
      } else {
      existing.setDimensions({ width, height });
      return;
      }
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

    // If layoutDocument is provided, render from layout objects instead of blocks
    if (layoutDocument) {
      const pageLayout = layoutDocument.pages.find((p) => p.index === pageIndex);
      if (pageLayout) {
        for (const obj of pageLayout.objects) {
          const spec = fabricSpecFromLayoutObject(obj, pageLayout.id);
          const fabricObj = createFabricObject(spec, {
            layoutObjectId: obj.id,
            layoutObjectType: obj.type,
            pageId: pageLayout.id,
            blockId: obj.id,
            blockType: obj.type,
          });
          if (fabricObj) fcanvas.add(fabricObj);
        }
      }
    } else {
    for (const block of pageBlocks) {
      if (block.type === "image") {
        loadImageBlock(block, scale, fcanvas);
        continue;
      }

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
      // Handle layout object modifications via page layout store
      const target = e.target as FabricObjectWithMeta | undefined;
      const layoutId = target?.data?.layoutObjectId;
      if (layoutId) {
        const { getState } = usePageLayoutStore;
        const { document: layoutDoc, activePageId } = getState();
        if (layoutDoc) {
          const pageId = `page-${pageIndex}`;
          const obj = e.target as any;
          const left = (obj.left ?? 0) / scale;
          const top = (obj.top ?? 0) / scale;
          const w = ((obj.width ?? 0) * (obj.scaleX ?? 1)) / scale;
          const h = ((obj.height ?? 0) * (obj.scaleY ?? 1)) / scale;
          getState().moveObject(pageId, layoutId, left, top);
          getState().resizeObject(pageId, layoutId, w, h);
        }
        return;
      }

      if (suggestModeRef.current && e.target) {
        const blockId = (e.target as FabricObjectWithMeta).data?.blockId;
        if (blockId) {
          const existing = (currentModelRef.current.blocks ?? []).find((b) => b.id === blockId);
          if (existing) {
            const obj = e.target;
            const canvasBbox = rectFromCanvasObjectBounds(
              obj.left ?? 0, obj.top ?? 0,
              (obj.width ?? 0) * (obj.scaleX ?? 1), (obj.height ?? 0) * (obj.scaleY ?? 1),
              scale
            );
            captureChange({
              blockId,
              field: "bounding_box",
              oldValue: existing.bounding_box,
              newValue: canvasBbox,
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
        if (syncedModel) {
          currentModelRef.current = syncedModel;
          onModelChange?.(syncedModel);
        }
        if (e.target && e.target.type === "textbox") {
          const blockId = (e.target as FabricObjectWithMeta).data?.blockId;
          const beforeBlock = blockId ? (model.blocks ?? []).find((b) => b.id === blockId) : null;
          if (blockId && beforeBlock) {
            const tb = e.target as Textbox;
            const beforeText = beforeBlock.content ?? "";
            const afterText = tb.text ?? "";
            if (beforeText !== afterText) {
              const nativeOp = {
                id: crypto.randomUUID(),
                type: "replace_text" as const,
                pageIndex,
                targetObjectId: blockId,
                before: { text: beforeText, bbox: beforeBlock.bounding_box },
                after: { text: afterText, bbox: rectFromCanvasObjectBounds(
                  tb.left ?? 0, tb.top ?? 0,
                  (tb.width ?? 0) * (tb.scaleX ?? 1), (tb.height ?? 0) * (tb.scaleY ?? 1),
                  scale
                )},
                createdAt: new Date().toISOString(),
              };
              opStore.applyOperation(nativeOp);
              onNativeOperation?.(nativeOp);
            }
          }
        }
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
            const yjsBbox = rectFromCanvasObjectBounds(
              obj.left ?? 0, obj.top ?? 0,
              (obj.width ?? 0) * (obj.scaleX ?? 1), (obj.height ?? 0) * (obj.scaleY ?? 1),
              scale
            );
            ydocRef.current.transact(() => {
              yBlock.set("bounding_box", yjsBbox);
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
      lastInteractedPageIndexRef.current = pageIndex;
      const target = e.target;
      if (!target) {
        addShape(pageIndex);
        return;
      }
      if (!shouldEditFabricTextInPlace(target.type)) return;
      fcanvas.setActiveObject(target);
      if ("enterEditing" in target && typeof target.enterEditing === "function") {
        target.enterEditing();
      }
      if ("selectAll" in target && typeof target.selectAll === "function") {
        target.selectAll();
      }
      fcanvas.renderAll();
    });
    fcanvas.on("mouse:down", (e) => {
      lastInteractedPageIndexRef.current = pageIndex;
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
      lastInteractedPageIndexRef.current = pageIndex;
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
      lastInteractedPageIndexRef.current = pageIndex;
      handleSelection(fcanvas);
      const obj = fcanvas.getActiveObject();
      const blockId = (obj as FabricObjectWithMeta | undefined)?.data?.blockId ?? null;
      providerRef.current?.awareness.setLocalStateField("user", {
        ...(providerRef.current?.awareness.getLocalState() as AwarenessState | null)?.user,
        selectedBlockId: blockId,
      });
    });
    fcanvas.on("selection:updated", () => {
      lastInteractedPageIndexRef.current = pageIndex;
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

  const canvasInsertLayoutObject = useCallback((canvas: Canvas, pageIndex: number, obj: LayoutObject) => {
    const pageId = `page-${pageIndex}`;
    usePageLayoutStore.getState().insertObject(pageId, obj);

    const spec = fabricSpecFromLayoutObject(obj, pageId);
    const fabricObj = createFabricObject(spec, {
      layoutObjectId: obj.id,
      layoutObjectType: obj.type,
      pageId,
      blockId: obj.id,
      blockType: obj.type,
    });
    if (fabricObj) {
      canvas.add(fabricObj);
      canvas.setActiveObject(fabricObj);
      canvas.renderAll();
    }
  }, []);

  const createCanvasBlockId = () => `blk_canvas_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const addShape = (pageIndex: number, tool: ShapeTool = activeTool) => {
    const canvas = fabricCanvasesRef.current.get(pageIndex);
    if (!canvas || tool === "select" || tool === "draw") return;

    if (tool === "image") {
      if (!imageInputRef.current) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          try {
            const { uploadDocumentImageAsset, createImageFrame } = await import("@/lib/pageLayout/assets");
            const asset = await uploadDocumentImageAsset(documentId, file);
            const imgFrame = createImageFrame(70, 70, 300, 200, asset.url, asset.assetKey);
            canvasInsertLayoutObject(canvas, pageIndex, imgFrame);
          } catch (err) {
            console.error("Image upload failed:", err);
          }
        };
        imageInputRef.current = input;
        document.body.appendChild(input);
      }
      imageInputRef.current.click();
      return;
    }

    if (tool === "table") {
      canvasInsertLayoutObject(canvas, pageIndex, createDefaultTableFrame(70, 70));
      return;
    }

    if (tool === "symbol") {
      canvasInsertLayoutObject(canvas, pageIndex, createSymbolFrame("✓", 70, 70));
      return;
    }

    if (tool === "highlight") {
      canvasInsertLayoutObject(canvas, pageIndex, createHighlightFrame(70, 70, 200, 30));
      return;
    }

    if (tool === "comment") {
      canvasInsertLayoutObject(canvas, pageIndex, createCommentFrame(70, 70, "Comment", "You"));
      return;
    }

    if (tool === "signature") {
      canvasInsertLayoutObject(canvas, pageIndex, createSignatureFrame(70, 70, "Signature"));
      return;
    }

    if (tool === "header_footer") {
      const header = new Textbox("Header", {
        left: 72,
        top: 28,
        width: 300,
        fontSize: 11 * scale,
        fontFamily: "Georgia, serif",
        fill: "#111111",
        editable: true,
      });
      (header as FabricObjectWithMeta).data = { blockId: createCanvasBlockId(), blockType: "paragraph", shapeType: "textbox" };
      const footer = new Textbox("Footer", {
        left: 72,
        top: Math.max((pageDimensions[pageIndex]?.height ?? primaryPage.height) * scale - 52, 28),
        width: 300,
        fontSize: 11 * scale,
        fontFamily: "Georgia, serif",
        fill: "#111111",
        editable: true,
      });
      (footer as FabricObjectWithMeta).data = { blockId: createCanvasBlockId(), blockType: "paragraph", shapeType: "textbox" };
      canvas.add(header, footer);
      canvas.setActiveObject(header);
      canvas.renderAll();
      return;
    }

    if (tool === "page_number") {
      const pageWidth = (pageDimensions[pageIndex]?.width ?? primaryPage.width) * scale;
      const pageHeight = (pageDimensions[pageIndex]?.height ?? primaryPage.height) * scale;
      const pageNumber = new Textbox(`Page ${pageIndex + 1}`, {
        left: Math.max(pageWidth - 140, 72),
        top: Math.max(pageHeight - 52, 28),
        width: 90,
        fontSize: 10 * scale,
        fontFamily: "Georgia, serif",
        fill: "#111111",
        editable: true,
        textAlign: "right",
      });
      (pageNumber as FabricObjectWithMeta).data = { blockId: createCanvasBlockId(), blockType: "paragraph", shapeType: "textbox" };
      canvas.add(pageNumber);
      canvas.setActiveObject(pageNumber);
      canvas.renderAll();
      return;
    }

    let shape;
    if (tool === "rect") {
      shape = new Rect({ left: 70, top: 70, width: 140, height: 90, fill: "rgba(14,165,233,0.12)", stroke: "#0284c7", strokeWidth: 2 });
      (shape as FabricObjectWithMeta).data = { blockId: createCanvasBlockId(), blockType: "shape", shapeType: "rect", layoutObjectId: `shape-${Date.now()}` };
    } else if (tool === "roundedRect") {
      shape = new Rect({ left: 80, top: 80, width: 160, height: 96, rx: 16, ry: 16, fill: "rgba(99,102,241,0.12)", stroke: "#4f46e5", strokeWidth: 2 });
      (shape as FabricObjectWithMeta).data = { blockId: createCanvasBlockId(), blockType: "shape", shapeType: "rounded-rect", layoutObjectId: `shape-${Date.now()}` };
    } else if (tool === "ellipse") {
      shape = new Ellipse({ left: 90, top: 90, rx: 70, ry: 45, fill: "rgba(34,197,94,0.12)", stroke: "#16a34a", strokeWidth: 2 });
      (shape as FabricObjectWithMeta).data = { blockId: createCanvasBlockId(), blockType: "shape", shapeType: "ellipse", layoutObjectId: `shape-${Date.now()}` };
    } else if (tool === "arrow") {
      shape = new Line([120, 120, 290, 220], { stroke: "#dc2626", strokeWidth: 3 });
      (shape as FabricObjectWithMeta).data = { blockId: createCanvasBlockId(), blockType: "shape", shapeType: "arrow", arrowHeadLength: 14, arrowHeadAngle: 28, layoutObjectId: `shape-${Date.now()}` };
    } else if (tool === "line") {
      shape = new Line([120, 120, 290, 220], { stroke: "#f97316", strokeWidth: 3 });
      (shape as FabricObjectWithMeta).data = { blockId: createCanvasBlockId(), blockType: "shape", shapeType: "line", layoutObjectId: `shape-${Date.now()}` };
    } else if (tool === "sticky") {
      shape = new IText("Sticky note", { left: 120, top: 140, fill: "#3f3f46", fontSize: 16, fontFamily: "Georgia", backgroundColor: "#fff59d" });
      (shape as FabricObjectWithMeta).data = { blockId: createCanvasBlockId(), blockType: "shape", shapeType: "sticky-note", noteFill: "#fff59d", textColor: "#3f3f46", layoutObjectId: `shape-${Date.now()}` };
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
      (tb as FabricObjectWithMeta).data = { blockId: createCanvasBlockId(), blockType: "paragraph", shapeType: "textbox" };
      canvas.add(tb);
      canvas.setActiveObject(tb);
      canvas.renderAll();
      return;
    }

    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
  };

  const getToolbarTargetPageIndex = () => {
    for (const [pageIndex, canvas] of fabricCanvasesRef.current.entries()) {
      if (canvas.getActiveObject()) return pageIndex;
    }
    if (fabricCanvasesRef.current.has(lastInteractedPageIndexRef.current)) return lastInteractedPageIndexRef.current;
    return Array.from(fabricCanvasesRef.current.keys()).sort((a, b) => a - b)[0] ?? 0;
  };

  const handleToolbarToolClick = (tool: ShapeTool) => {
    setActiveTool(tool);
    if (!shouldInsertToolImmediately(tool)) return;
    addShape(getToolbarTargetPageIndex(), tool);
    setActiveTool(getActiveToolAfterToolbarClick(tool));
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const canvasToolbar = (
      <div className="sticky top-4 z-40 mx-auto mb-4 w-full min-w-[760px] max-w-[1200px]">
        <div className="rounded-2xl border border-white/10 bg-[var(--bg-elevated)] shadow-[0_1px_0_inset_rgb(255_255_255/6%),0_8px_24px_-8px_rgb(0_0_0/50%)] backdrop-blur-xl">
          <div className="flex items-center gap-1 px-2 py-1.5">

          {/* ── Group 1: Drawing tools ── */}
          {([
            { tool: "select",      Icon: CursorArrowRaysIcon,         label: "Select",       shortcut: "V" },
            { tool: "rect",        Icon: StopIcon,                    label: "Rectangle",    shortcut: "R" },
            { tool: "roundedRect", Icon: RectangleGroupIcon,          label: "Rounded rect", shortcut: "⇧R" },
            { tool: "ellipse",     Icon: EllipsisHorizontalCircleIcon,label: "Ellipse",      shortcut: "O" },
            { tool: "line",        Icon: MinusIcon,                   label: "Line",         shortcut: "L" },
            { tool: "arrow",       Icon: ArrowLongRightIcon,          label: "Arrow",        shortcut: "A" },
            { tool: "text",        Icon: PencilSquareIcon,            label: "Text",         shortcut: "T" },
            { tool: "sticky",      Icon: ClipboardDocumentIcon,       label: "Sticky note",  shortcut: "S" },
            { tool: "draw",        Icon: PencilIcon,                  label: "Freehand",     shortcut: "P" },
          ] as { tool: ShapeTool; Icon: React.FC<React.SVGProps<SVGSVGElement>>; label: string; shortcut: string }[]).map(({ tool, Icon, label, shortcut }) => (
            <GlassTooltip key={tool} label={label} shortcut={shortcut} placement="bottom">
              <button
                onClick={() => handleToolbarToolClick(tool)}
                aria-label={label}
                aria-pressed={activeTool === tool}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  activeTool === tool
                    ? "bg-white/10 text-white ring-1 ring-white/20"
                    : "text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            </GlassTooltip>
          ))}

          {/* Sticky colour swatches — visible only when sticky is active */}
          {activeTool === "sticky" && (
            <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
              {["#fff59d", "#a5d6a7", "#90caf9", "#f48fb1", "#ce93d8"].map((color) => (
                <button
                  key={color}
                  className="h-4 w-4 rounded-full border border-black/20 transition-transform hover:scale-125 active:scale-110"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}

          <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />

          {/* ── Group 2: Insert and annotation tools ── */}
          {([
            { tool: "image", Icon: PhotoIcon, label: "Image" },
            { tool: "table", Icon: TableCellsIcon, label: "Table" },
            { tool: "symbol", Icon: VariableIcon, label: "Symbol" },
            { tool: "highlight", Icon: SunIcon, label: "Highlight" },
            { tool: "comment", Icon: ChatBubbleLeftRightIcon, label: "Comment" },
            { tool: "signature", Icon: PencilSquareIcon, label: "Signature" },
            { tool: "header_footer", Icon: DocumentTextIcon, label: "Header/Footer" },
            { tool: "page_number", Icon: HashtagIcon, label: "Page number" },
          ] as { tool: ShapeTool; Icon: React.FC<React.SVGProps<SVGSVGElement>>; label: string }[]).map(({ tool, Icon, label }) => (
            <GlassTooltip key={tool} label={label} placement="bottom">
              <button
                onClick={() => handleToolbarToolClick(tool)}
                aria-label={label}
                aria-pressed={activeTool === tool}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  activeTool === tool
                    ? "bg-white/10 text-white ring-1 ring-white/20"
                    : "text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            </GlassTooltip>
          ))}

          <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />

          {/* ── Group 3: Modes ── */}
          <GlassTooltip label="Suggest mode" placement="bottom">
            <button
              onClick={() => { toggleSuggestMode(); trackEdit("suggest_mode_toggled", { enabled: !suggestMode }); }}
              aria-pressed={suggestMode}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${suggestMode ? "bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]/30" : "text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-primary)]"}`}
            >
              <LightBulbIcon className="h-4 w-4" />
            </button>
          </GlassTooltip>

          <GlassTooltip label="Form mode" placement="bottom">
            <button
              onClick={() => { toggleFormMode(); trackEdit("form_mode_toggled", { enabled: !formMode }); }}
              aria-pressed={formMode}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${formMode ? "bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]/30" : "text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-primary)]"}`}
            >
              <ClipboardDocumentCheckIcon className="h-4 w-4" />
            </button>
          </GlassTooltip>

          {formMode && selectedBlock?.blockId && (
            <GlassTooltip label="Convert to field" placement="bottom">
              <button
                onClick={() => convertBlockToField(selectedBlock.blockId, "text")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
            </GlassTooltip>
          )}

          <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />

          {/* ── Group 4: Actions ── */}
          <GlassTooltip label="AI summarise" placement="bottom">
            <button
              onClick={() => void summariseDoc()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
            >
              <SparklesIcon className="h-4 w-4" />
            </button>
          </GlassTooltip>

          {/* Smart Style */}
          <select
            title="Smart Style"
            className="h-8 rounded-lg border border-white/10 bg-transparent px-2 text-[11px] font-medium text-[var(--text-tertiary)] transition-colors hover:border-white/20 hover:text-[var(--text-primary)] focus:outline-none cursor-pointer"
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
            <option value="" disabled>Style</option>
            {SMART_STYLE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>

          {/* Overflow: Save Version + other rare actions */}
          <div className="relative" ref={overflowMenuRef}>
            <GlassTooltip label="More actions" placement="bottom">
              <button
                onClick={() => setShowOverflowMenu((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
              >
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </button>
            </GlassTooltip>
            {showOverflowMenu && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border border-white/10 bg-[var(--bg-elevated)] py-1 shadow-2xl backdrop-blur-xl">
                <button
                  onClick={() => { void saveVersionSnapshot(); setShowOverflowMenu(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
                >
                  <BookmarkIcon className="h-3.5 w-3.5 shrink-0" /> Save version
                </button>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />

            {/* ── Zoom controls ── */}
            <GlassTooltip label="Zoom out" shortcut="⌘−" placement="bottom">
              <button
                onClick={() => changeZoom("out")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
              >
                <MagnifyingGlassMinusIcon className="h-4 w-4" />
              </button>
            </GlassTooltip>

            <button
              onClick={() => changeZoom("reset")}
              className="min-w-[44px] rounded-lg px-2 py-1 text-center font-mono text-[11px] text-[var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
              title="Reset zoom (⌘0)"
            >
              {Math.round(userZoom * 100)}%
            </button>

            <GlassTooltip label="Zoom in" shortcut="⌘+" placement="bottom">
              <button
                onClick={() => changeZoom("in")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
              >
                <MagnifyingGlassPlusIcon className="h-4 w-4" />
              </button>
            </GlassTooltip>

            <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />

            {/* ── History ── */}
            <GlassTooltip label="Undo" shortcut="⌘Z" placement="bottom">
              <button
                onClick={undo}
                disabled={history.length === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)] disabled:opacity-25"
              >
                <ArrowUturnLeftIcon className="h-4 w-4" />
              </button>
            </GlassTooltip>

            <GlassTooltip label="Redo" shortcut="⌘⇧Z" placement="bottom">
              <button
                onClick={redo}
                disabled={redoStack.length === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)] disabled:opacity-25"
              >
                <ArrowUturnRightIcon className="h-4 w-4" />
              </button>
            </GlassTooltip>

            {/* ── Presence avatars ── */}
            <div className="ml-1 flex -space-x-2">
              {awarenessUsers.slice(0, 5).map((user) => (
                <div
                  key={user.id}
                  title={user.name}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--bg-elevated)] text-[8px] font-bold text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {(user.name || "?")[0]?.toUpperCase()}
                </div>
              ))}
              {awarenessUsers.length > 5 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--bg-elevated)] bg-[#555] text-[8px] font-bold text-white">
                  +{awarenessUsers.length - 5}
                </div>
              )}
            </div>
          </div>

          </div>{/* end toolbar row */}
          <FormatBar embedded />
        </div>
      </div>
  );

  const renderedCanvasToolbar = shouldRenderInlineCanvasToolbar(toolbarHost)
    ? canvasToolbar
    : toolbarHost
      ? createPortal(canvasToolbar, toolbarHost)
      : null;

  return (
    <div ref={rootRef} className="h-full overflow-auto bg-[var(--bg-surface)] p-4 md:p-6 xl:p-8">

      {renderedCanvasToolbar}

      <FindReplaceBar
        model={model}
        onModelChange={(nextModel) => {
          pushToHistory(nextModel);
          saveDebounced.current(nextModel);
          currentModelRef.current = nextModel;
        }}
      />
      <AIApplyEffectsLayer phase={aiState.phase} profile={animationProfile} />

      <div className="mx-auto mb-3 w-full max-w-[1200px]">
        <AIStatusHelper
          phase={aiState.phase}
          onApply={() => dispatchAi({ type: "START_STAGING" })}
          onViewDiff={() => {}}
          onUndo={() => dispatchAi({ type: "REVERT" })}
          onDismiss={() => dispatchAi({ type: "RESET" })}
        />
        {aiSummary && (
          <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[#0A0A0A]/90 px-3 py-2 text-xs text-[var(--text-secondary)] backdrop-blur-sm">
            <span className="mr-2 font-semibold text-[var(--text-primary)]">AI Summary</span>
            {aiSummary}
          </div>
        )}
      </div>

      {/* Pages */}
      {/* eslint-disable-next-line react-hooks/refs -- pageDimensions is state derived, not a ref */}
      <div className="mx-auto flex w-full min-w-[760px] max-w-[1200px] flex-col gap-8">
        {pageDimensions.map((dim) => (
          <PageErrorBoundary key={dim.page_index} pageIndex={dim.page_index}>
            <VirtualizedPage
              dim={dim}
              scale={scale}
              backgroundUrl={pageImages[dim.page_index]}
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
