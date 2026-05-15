"use client";

import type { LayoutObject } from "@/types/pageLayout";
import { usePageLayoutStore } from "@/store/usePageLayoutStore";
import { getCatalogFonts } from "./fontCatalog";

export default function PageLayoutInspector() {
  const document = usePageLayoutStore((s) => s.document);
  const selectedIds = usePageLayoutStore((s) => s.selectedObjectIds);
  const updateObject = usePageLayoutStore((s) => s.updateObject);

  if (!document || selectedIds.length === 0) {
    return (
      <div className="p-3 text-[11px] text-[var(--text-tertiary)]">
        Select an object to inspect
      </div>
    );
  }

  const selectedId = selectedIds[0];

  let selectedObject: LayoutObject | undefined;
  for (const page of document.pages) {
    const found = page.objects.find((o) => o.id === selectedId);
    if (found) {
      selectedObject = found;
      break;
    }
  }

  if (!selectedObject) {
    return (
      <div className="p-3 text-[11px] text-[var(--text-tertiary)]">
        Object not found
      </div>
    );
  }

  const page = document.pages.find((p) =>
    p.objects.some((o) => o.id === selectedId),
  );

  return (
    <div className="p-3 space-y-3">
      <div className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-tertiary)]">
        Inspector
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-[var(--text-tertiary)]">X</label>
          <input
            type="number"
            value={Math.round(selectedObject.x)}
            onChange={(e) => updateObject(page?.id ?? "", selectedId, { x: Number(e.target.value) })}
            className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none"
          />
        </div>
        <div>
          <label className="text-[9px] text-[var(--text-tertiary)]">Y</label>
          <input
            type="number"
            value={Math.round(selectedObject.y)}
            onChange={(e) => updateObject(page?.id ?? "", selectedId, { y: Number(e.target.value) })}
            className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none"
          />
        </div>
      </div>

      {/* Image controls */}
      {selectedObject.type === "image" && (
        <div>
          <label className="text-[9px] text-[var(--text-tertiary)]">Image Source</label>
          <p className="mt-0.5 truncate text-[10px] text-[var(--text-secondary)]">
            {selectedObject.src || "(no source)"}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">Width</label>
              <input
                type="number"
                value={Math.round(selectedObject.width)}
                onChange={(e) => updateObject(page?.id ?? "", selectedId, { width: Number(e.target.value) })}
                className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">Height</label>
              <input
                type="number"
                value={Math.round(selectedObject.height)}
                onChange={(e) => updateObject(page?.id ?? "", selectedId, { height: Number(e.target.value) })}
                className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Shape controls */}
      {selectedObject.type === "shape" && (
        <div>
          <label className="text-[9px] text-[var(--text-tertiary)]">Shape</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">Fill</label>
              <input
                type="color"
                value={selectedObject.fill || "transparent"}
                onChange={(e) => updateObject(page?.id ?? "", selectedId, { fill: e.target.value })}
                className="w-full h-7 rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">Stroke</label>
              <input
                type="color"
                value={selectedObject.stroke || "#111111"}
                onChange={(e) => updateObject(page?.id ?? "", selectedId, { stroke: e.target.value })}
                className="w-full h-7 rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Font controls only for text frames */}
      {selectedObject.type === "text" && (
        <>
          <div>
            <label className="text-[9px] text-[var(--text-tertiary)]">Font</label>
            <select
              value={selectedObject.fontFamily}
              onChange={(e) => updateObject(page?.id ?? "", selectedId, { fontFamily: e.target.value })}
              className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none"
            >
              {getCatalogFonts().map((f) => (
                <option key={f.id} value={f.cssFamily}>
                  {f.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">Size</label>
              <input
                type="number"
                value={selectedObject.fontSize}
                onChange={(e) => updateObject(page?.id ?? "", selectedId, { fontSize: Number(e.target.value) })}
                className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">Color</label>
              <input
                type="color"
                value={selectedObject.color}
                onChange={(e) => updateObject(page?.id ?? "", selectedId, { color: e.target.value })}
                className="w-full h-7 rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] cursor-pointer"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={selectedObject.fontWeight === "bold"}
                onChange={(e) => updateObject(page?.id ?? "", selectedId, { fontWeight: e.target.checked ? "bold" : "normal" })}
              />
              Bold
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={selectedObject.fontStyle === "italic"}
                onChange={(e) => updateObject(page?.id ?? "", selectedId, { fontStyle: e.target.checked ? "italic" : "normal" })}
              />
              Italic
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={selectedObject.underline}
                onChange={(e) => updateObject(page?.id ?? "", selectedId, { underline: e.target.checked })}
              />
              U
            </label>
          </div>

          <div>
            <label className="text-[9px] text-[var(--text-tertiary)]">Align</label>
            <div className="flex gap-1 mt-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => updateObject(page?.id ?? "", selectedId, { textAlign: a })}
                  className={`flex-1 rounded px-1.5 py-1 text-[10px] font-medium uppercase transition-colors ${
                    selectedObject.textAlign === a
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
