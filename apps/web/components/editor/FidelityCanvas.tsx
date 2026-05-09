"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import debounce from "lodash/debounce";
import { Canvas, Ellipse, IText, Line, PencilBrush, Rect, Textbox } from "fabric";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import { useSaveDocumentMutation } from "@/hooks/useDocumentQueries";
import { useFidelityCanvasStore, type ShapeTool, type SelectedBlockMeta } from "@/store/useFidelityCanvasStore";
import FormatBar from "@/components/editor/FormatBar";

type FidelityCanvasProps = {
  documentId: string;
  model: DocumentModel;
  onModelChange?: (model: DocumentModel) => void;
};

const DEFAULT_PAGE = { page_index: 0, width: 595.28, height: 841.89 };

// ── Fabric object factory ─────────────────────────────────────────────────────

function createTextBlock(block: DocumentBlock, scale: number) {
  const bbox = block.bounding_box ?? [72, 72, 540, 86];
  const fm = block.font_meta ?? {};
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function FidelityCanvas({ documentId, model, onModelChange }: FidelityCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const yDocRef = useRef<Y.Doc | null>(null);
  const yMapRef = useRef<Y.Map<string> | null>(null);
  const fabricCanvasesRef = useRef<Map<number, Canvas>>(new Map());
  const saveMutation = useSaveDocumentMutation(documentId);

  const { activeTool, setActiveTool, setSelectedBlock, pendingFormat, clearPendingFormat } = useFidelityCanvasStore();

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

  // ── Yjs (text content sync for collaboration — Phase 10) ─────────────────

  useEffect(() => {
    const ydoc = new Y.Doc();
    const ymap = ydoc.getMap<string>(`fidelity-${documentId}`);
    yDocRef.current = ydoc;
    yMapRef.current = ymap;

    for (const block of model.blocks ?? []) {
      if (block.content) ymap.set(block.id, block.content);
    }

    const observer = () => {
      // Sync Yjs text changes into Fabric Textbox objects
      const map = yMapRef.current;
      if (!map) return;
      for (const [pageIndex, canvas] of fabricCanvasesRef.current.entries()) {
        for (const obj of canvas.getObjects()) {
          const blockId = (obj as any).data?.blockId;
          if (!blockId || obj.type !== "textbox") continue;
          const newText = map.get(blockId);
          if (newText !== undefined && (obj as Textbox).text !== newText) {
            (obj as Textbox).set("text", newText);
            canvas.renderAll();
          }
        }
      }
    };

    ymap.observe(observer);
    return () => {
      ymap.unobserve(observer);
      ydoc.destroy();
      saveDebounced.current.cancel();
    };
  }, [documentId]);

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
      const obj = block.type === "shape"
        ? createShapeBlock(block, scale)
        : createTextBlock(block, scale);
      fcanvas.add(obj);
    }

    const sync = debounce(() => syncCanvasToModel(pageIndex, fcanvas), 400);
    fcanvas.on("object:added", sync);
    fcanvas.on("object:modified", sync);
    fcanvas.on("object:removed", sync);
    fcanvas.on("path:created", sync);
    fcanvas.on("selection:created", () => handleSelection(fcanvas));
    fcanvas.on("selection:updated", () => handleSelection(fcanvas));
    fcanvas.on("selection:cleared", () => setSelectedBlock(null));

    fabricCanvasesRef.current.set(pageIndex, fcanvas);
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
        </div>
      </div>

      {/* Format Bar — appears when a text block is selected */}
      <FormatBar />

      {/* Pages */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8">
        {pageDimensions.map((dim) => (
          <div
            key={dim.page_index}
            className="relative mx-auto rounded-sm bg-white shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
            style={{ width: `${dim.width * scale}px`, height: `${dim.height * scale}px` }}
          >
            {/* Single Fabric canvas covers the full page — handles all blocks */}
            <canvas
              className="absolute inset-0 z-10"
              ref={(node) => {
                if (!node) return;
                setupFabricCanvas(dim.page_index, node, dim.width * scale, dim.height * scale);
              }}
              onDoubleClick={() => addShape(dim.page_index)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
