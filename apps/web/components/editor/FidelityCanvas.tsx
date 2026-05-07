"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import debounce from "lodash/debounce";
import { Canvas, Ellipse, IText, Line, PencilBrush, Rect } from "fabric";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import { useSaveDocumentMutation } from "@/hooks/useDocumentQueries";

type FidelityCanvasProps = {
  documentId: string;
  model: DocumentModel;
  onModelChange?: (model: DocumentModel) => void;
};

const DEFAULT_PAGE = { page_index: 0, width: 595.28, height: 841.89 };
type ShapeTool = "select" | "rect" | "roundedRect" | "ellipse" | "line" | "arrow" | "text" | "sticky" | "draw";

export default function FidelityCanvas({ documentId, model, onModelChange }: FidelityCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const yDocRef = useRef<Y.Doc | null>(null);
  const yMapRef = useRef<Y.Map<string> | null>(null);
  const fabricCanvasesRef = useRef<Map<number, Canvas>>(new Map());
  const [activeTool, setActiveTool] = useState<ShapeTool>("select");
  const saveMutation = useSaveDocumentMutation(documentId);

  // Undo/Redo State
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if editing text
      if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || (document.activeElement as HTMLElement).isContentEditable)) {
         return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) redo();
        else undo();
        e.preventDefault();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        void saveMutation.mutateAsync(model);
        e.preventDefault();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        let deleted = false;
        for (const canvas of fabricCanvasesRef.current.values()) {
          const activeObjects = canvas.getActiveObjects();
          if (activeObjects.length > 0) {
            // Delete text inside active IText objects if they are in editing mode
            // Actually, if an IText is in editing mode, it sets isContentEditable or we shouldn't delete the whole shape.
            // Fabric handles Backspace internally when editing IText.
            const activeObj = activeObjects[0];
            if (activeObj.type === "i-text" && (activeObj as IText).isEditing) {
              continue;
            }
            
            canvas.discardActiveObject();
            canvas.remove(...activeObjects);
            deleted = true;
          }
        }
        if (deleted) e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [model, history, redoStack]);

  const pageDimensions = model.page_dimensions.length ? model.page_dimensions : [DEFAULT_PAGE];
  const primaryPage = pageDimensions[0] || DEFAULT_PAGE;
  const scale = Math.max(0.4, Math.min(2, containerWidth / primaryPage.width));

  const blocksByPage = useMemo(() => {
    const grouped = new Map<number, DocumentBlock[]>();
    for (const block of model.blocks || []) {
      const key = block.page_index ?? 0;
      const pageBlocks = grouped.get(key) || [];
      pageBlocks.push(block);
      grouped.set(key, pageBlocks);
    }
    for (const [, pageBlocks] of grouped) {
      pageBlocks.sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
    }
    return grouped;
  }, [model.blocks]);

  useEffect(() => {
    const update = () => {
      if (!rootRef.current) return;
      setContainerWidth(rootRef.current.clientWidth - 64);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const saveModelDebounced = useRef(
    debounce((nextModel: DocumentModel) => {
      void saveMutation.mutateAsync(nextModel);
    }, 700)
  );

  useEffect(() => {
    const ydoc = new Y.Doc();
    const ymap = ydoc.getMap<string>(`fidelity-${documentId}`);
    yDocRef.current = ydoc;
    yMapRef.current = ymap;

    for (const block of model.blocks || []) {
      ymap.set(block.id, block.content || "");
    }

    const observer = () => {
      const map = yMapRef.current;
      if (!map) return;
      const updatedBlocks = (model.blocks || []).map((block) => ({
        ...block,
        content: map.get(block.id) ?? block.content ?? "",
      }));
      const nextModel: DocumentModel = {
        ...model,
        blocks: updatedBlocks,
      };
      onModelChange?.(nextModel);
      saveModelDebounced.current(nextModel);
    };

    ymap.observe(observer);
    return () => {
      ymap.unobserve(observer);
      ydoc.destroy();
      saveModelDebounced.current.cancel();
    };
  }, [documentId, model, onModelChange]);

  const updateBlockContent = (blockId: string, text: string) => {
    const map = yMapRef.current;
    if (!map) return;
    map.set(blockId, text);
  };

  const syncShapesToModel = (pageIndex: number, canvas: Canvas) => {
    const shapeBlocksForPage: DocumentBlock[] = canvas.getObjects().map((object, idx) => {
      const left = object.left || 0;
      const top = object.top || 0;
      const width = (object.width || 1) * (object.scaleX || 1);
      const height = (object.height || 1) * (object.scaleY || 1);
      const shapeId = (object as unknown as { data?: { blockId?: string } }).data?.blockId || `shape_${pageIndex}_${idx}_${Date.now()}`;
      const shapeType = (object as unknown as { data?: { shapeType?: string } }).data?.shapeType || (object.type === "i-text" ? "textbox" : object.type);
      return {
        id: shapeId,
        type: "shape",
        content: object.type === "i-text" ? ((object as unknown as { text?: string }).text || "") : "",
        confidence_score: 1,
        needs_review: false,
        bounding_box: [left / scale, top / scale, (left + width) / scale, (top + height) / scale],
        style_overrides: {},
        fabric_data: {
          ...(object.toObject() as Record<string, unknown>),
          ...((object as unknown as { data?: Record<string, unknown> }).data || {}),
          type: shapeType,
        },
        z_index: idx,
        page_index: pageIndex,
      } as DocumentBlock;
    });

    const nonShapeBlocks = (model.blocks || []).filter((block) => !(block.type === "shape" && block.page_index === pageIndex));
    const nextModel: DocumentModel = {
      ...model,
      blocks: [...nonShapeBlocks, ...shapeBlocksForPage],
    };
    pushToHistory(nextModel);
    void saveMutation.mutateAsync(nextModel);
  };

  useEffect(() => {
    for (const [pageIndex, canvas] of fabricCanvasesRef.current.entries()) {
      canvas.dispose();
      fabricCanvasesRef.current.delete(pageIndex);
    }
  }, [documentId]);

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

    const shapeBlocks = (model.blocks || []).filter((block) => block.type === "shape" && (block.page_index ?? 0) === pageIndex);
    for (const shapeBlock of shapeBlocks) {
      const fabricData = (shapeBlock as unknown as { fabric_data?: Record<string, unknown> }).fabric_data || {};
      const bbox = shapeBlock.bounding_box || [72, 72, 140, 120];
      const left = bbox[0] * scale;
      const top = bbox[1] * scale;
      const objType = String(fabricData.type || "rect").toLowerCase();
      const stroke = String(fabricData.stroke || "#111111");
      const fill = String(fabricData.fill || "rgba(0,0,0,0)");
      const strokeWidth = Number(fabricData.strokeWidth || 2);

      let shape;
      if (objType === "ellipse" || objType === "circle") {
        shape = new Ellipse({
          left,
          top,
          rx: Math.max((bbox[2] - bbox[0]) * scale * 0.5, 8),
          ry: Math.max((bbox[3] - bbox[1]) * scale * 0.5, 8),
          stroke,
          fill,
          strokeWidth,
        });
      } else if (objType === "line" || objType === "arrow") {
        shape = new Line([left, top, bbox[2] * scale, bbox[3] * scale], {
          stroke,
          strokeWidth,
        });
      } else if (objType === "textbox" || objType === "text" || objType === "i-text" || objType === "sticky-note" || objType === "sticky_note") {
        shape = new IText(String(fabricData.text || shapeBlock.content || "Text"), {
          left,
          top,
          fill: String(fabricData.textColor || stroke),
          fontSize: Number(fabricData.fontSize || 18),
          fontFamily: String(fabricData.fontFamily || "Georgia"),
          backgroundColor: objType.includes("sticky") ? String(fabricData.noteFill || "#fff59d") : undefined,
        });
      } else {
        shape = new Rect({
          left,
          top,
          width: Math.max((bbox[2] - bbox[0]) * scale, 20),
          height: Math.max((bbox[3] - bbox[1]) * scale, 20),
          stroke,
          fill,
          strokeWidth,
        });
      }
      (shape as unknown as { data?: { blockId: string; shapeType: string } }).data = { blockId: shapeBlock.id, shapeType: objType };
      fcanvas.add(shape);
    }

    const sync = debounce(() => syncShapesToModel(pageIndex, fcanvas), 400);
    fcanvas.on("object:added", sync);
    fcanvas.on("object:modified", sync);
    fcanvas.on("object:removed", sync);
    fcanvas.on("path:created", sync);

    fabricCanvasesRef.current.set(pageIndex, fcanvas);
  };

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

  const addShape = (pageIndex: number) => {
    const canvas = fabricCanvasesRef.current.get(pageIndex);
    if (!canvas || activeTool === "select" || activeTool === "draw") return;

    let shape;
    if (activeTool === "rect") {
      shape = new Rect({ left: 70, top: 70, width: 140, height: 90, fill: "rgba(14,165,233,0.12)", stroke: "#0284c7", strokeWidth: 2 });
      (shape as unknown as { data?: { shapeType: string } }).data = { shapeType: "rect" };
    } else if (activeTool === "roundedRect") {
      shape = new Rect({ left: 80, top: 80, width: 160, height: 96, rx: 16, ry: 16, fill: "rgba(99,102,241,0.12)", stroke: "#4f46e5", strokeWidth: 2 });
      (shape as unknown as { data?: { shapeType: string } }).data = { shapeType: "rounded-rect" };
    } else if (activeTool === "ellipse") {
      shape = new Ellipse({ left: 90, top: 90, rx: 70, ry: 45, fill: "rgba(34,197,94,0.12)", stroke: "#16a34a", strokeWidth: 2 });
      (shape as unknown as { data?: { shapeType: string } }).data = { shapeType: "ellipse" };
    } else if (activeTool === "arrow") {
      shape = new Line([120, 120, 290, 220], { stroke: "#dc2626", strokeWidth: 3 });
      (shape as unknown as { data?: { shapeType: string; arrowHeadLength: number; arrowHeadAngle: number } }).data = {
        shapeType: "arrow",
        arrowHeadLength: 14,
        arrowHeadAngle: 28,
      };
    } else if (activeTool === "line") {
      shape = new Line([120, 120, 290, 220], { stroke: "#f97316", strokeWidth: 3 });
      (shape as unknown as { data?: { shapeType: string } }).data = { shapeType: "line" };
    } else if (activeTool === "sticky") {
      shape = new IText("Sticky note", {
        left: 120,
        top: 140,
        fill: "#3f3f46",
        fontSize: 16,
        fontFamily: "Georgia",
        backgroundColor: "#fff59d",
      });
      (shape as unknown as { data?: { shapeType: string; noteFill: string; textColor: string } }).data = {
        shapeType: "sticky-note",
        noteFill: "#fff59d",
        textColor: "#3f3f46",
      };
    } else {
      shape = new IText("Text box", { left: 120, top: 140, fill: "#111111", fontSize: 18, fontFamily: "Georgia" });
      (shape as unknown as { data?: { shapeType: string } }).data = { shapeType: "textbox" };
    }
    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
  };

  return (
    <div ref={rootRef} className="h-full overflow-y-auto bg-[var(--bg-surface)] p-8">
      <div className="mx-auto mb-4 flex w-full max-w-[1200px] items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 shadow-sm sticky top-4 z-40">
        {(["select", "rect", "roundedRect", "ellipse", "line", "arrow", "text", "sticky", "draw"] as ShapeTool[]).map((tool) => (
          <button
            key={tool}
            onClick={() => setActiveTool(tool)}
            className={`rounded px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${activeTool === tool ? "bg-[var(--accent)] text-[var(--text-on-accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-subtle)]"}`}
          >
            {tool}
          </button>
        ))}
        <div className="mx-2 h-6 w-px bg-[var(--border-subtle)] hidden md:block"></div>
        {activeTool === "sticky" && (
          <div className="flex gap-1 items-center mr-auto">
            {["#fff59d", "#a5d6a7", "#90caf9", "#f48fb1", "#ce93d8"].map(color => (
              <button 
                key={color} 
                className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform" 
                style={{ backgroundColor: color }}
                title="Select sticky color (feature stub)"
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
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8">
        {pageDimensions.map((dim) => {
          const pageBlocks = blocksByPage.get(dim.page_index) || [];
          return (
            <div
              key={dim.page_index}
              className="relative mx-auto rounded-sm bg-white shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
              style={{ width: `${dim.width * scale}px`, height: `${dim.height * scale}px` }}
            >
              <canvas
                className="absolute inset-0 z-20"
                ref={(node) => {
                  if (!node) return;
                  setupFabricCanvas(dim.page_index, node, dim.width * scale, dim.height * scale);
                }}
                onDoubleClick={() => addShape(dim.page_index)}
              />
              {pageBlocks.map((block) => {
                if (block.type === "shape") return null;
                const bbox = block.bounding_box || [72, 72, 523, 90];
                const left = bbox[0] * scale;
                const top = bbox[1] * scale;
                const width = Math.max((bbox[2] - bbox[0]) * scale, 24);
                const height = Math.max((bbox[3] - bbox[1]) * scale, 18);
                const fontMeta = block.font_meta;
                const fontSize = Math.max((fontMeta?.size || 11) * scale, 10);

                return (
                  <div
                    key={block.id}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(event) => updateBlockContent(block.id, event.currentTarget.textContent || "")}
                    onPaste={(event) => {
                      event.preventDefault();
                      const pastedText = event.clipboardData.getData("text/plain");
                      document.execCommand("insertText", false, pastedText);
                    }}
                    className="absolute z-10 overflow-hidden border border-transparent px-1 outline-none focus:border-orange-400"
                    style={{
                      left,
                      top,
                      width,
                      minHeight: `${height}px`,
                      color: fontMeta?.color || "#111111",
                      fontSize: `${fontSize}px`,
                      fontFamily: fontMeta?.family || "Georgia, serif",
                      fontWeight: fontMeta?.is_bold ? 700 : 400,
                      fontStyle: fontMeta?.is_italic ? "italic" : "normal",
                      lineHeight: 1.25,
                      zIndex: block.z_index ?? 0,
                    }}
                    ref={(node) => {
                      if (!node) return;
                      const overflow = node.scrollHeight > node.clientHeight + 1;
                      if (overflow) {
                        node.style.outline = "2px solid #f59e0b";
                      } else {
                        node.style.outline = "none";
                      }
                    }}
                  >
                    {block.content || ""}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
