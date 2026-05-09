# OLPDF Editor — Detailed Engineering Specification (Phases 8–20)

> **Vision:** Edit any PDF exactly like a Word document — live reflow, rich text, real-time collaboration, AI tools, offline-first, and a world-class UX. No gaps. No shortcuts.
>
> **Completed (Phases 0–7):** Rich block extraction (PyMuPDF `get_text("dict")`), Zustand state, Fabric.js canvas (drag/resize/format), FormatBar, Go export service (fidelity/PDF/A/tagged), pdfplumber table extraction, Rust/Wasm client-side parser, column detection.
>
> **This document:** Everything from Phase 8 onwards. Each phase is a self-contained engineering unit with exact file locations, data structures, algorithms, code, and integration contracts.

---

## Table of Contents

- [Phase 8 — Block Reflow Engine](#phase-8--block-reflow-engine)
- [Phase 9 — Rich Text Editing (TipTap Inline)](#phase-9--rich-text-editing-tiptap-inline)
- [Phase 10 — Page Virtualization](#phase-10--page-virtualization)
- [Phase 11 — Find & Replace](#phase-11--find--replace)
- [Phase 12 — Comments & Annotations](#phase-12--comments--annotations)
- [Phase 13 — Real-time Collaboration (Full Yjs)](#phase-13--real-time-collaboration-full-yjs)
- [Phase 14 — Track Changes](#phase-14--track-changes)
- [Phase 15 — Smart Styles System](#phase-15--smart-styles-system)
- [Phase 16 — AI Content Tools](#phase-16--ai-content-tools)
- [Phase 17 — Fillable Forms](#phase-17--fillable-forms)
- [Phase 18 — Offline-First PWA](#phase-18--offline-first-pwa)
- [Phase 19 — Export Suite](#phase-19--export-suite)
- [Phase 20 — Polish & Production Hardening](#phase-20--polish--production-hardening)

---

## Phase 8 — Block Reflow Engine

**Goal:** When a user types more text into a block, that block grows vertically and all blocks below it on the same page shift down. If content overflows the bottom margin, a continuation block is created on the next page. This is the single most important feature for DOCX parity.

### 8.1 Core Concept

In a Word document, the layout engine runs on every keystroke. In OLPDF, we replicate this with a `reflow(model, changedBlockId)` pure function that:

1. Estimates the new height of the changed block using Fabric's `calcTextHeight()`.
2. Computes delta-Y (new height − old height).
3. Shifts all blocks below the changed block (same page, same column) by delta-Y.
4. If any block now extends past the page's bottom margin, overflows to the next page.
5. Returns a new `DocumentModel` — no mutation.

### 8.2 Data Structures

```typescript
// No new types needed. Uses existing DocumentBlock and DocumentModel.
// Key fields used by reflow:
//   block.bounding_box: [x0, y0, x1, y1]  (in PDF points, top-left origin)
//   block.page_index: number
//   block.column_index: number             (from Phase 7)
//   block.id: string

interface ReflowResult {
  model: DocumentModel;
  overflowed: string[];  // block IDs that moved to a different page
}
```

### 8.3 Algorithm — `reflow(model, changedBlockId, canvas)`

```typescript
// apps/web/engine/reflow.ts

import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import type { Canvas, Textbox } from "fabric";

export function reflow(
  model: DocumentModel,
  changedBlockId: string,
  canvases: Map<number, Canvas>,    // live Fabric canvases keyed by page index
  pageDimensions: { page_index: number; width: number; height: number }[]
): DocumentModel {
  const blocks = [...(model.blocks ?? [])];
  const changedIdx = blocks.findIndex((b) => b.id === changedBlockId);
  if (changedIdx === -1) return model;

  const changed = blocks[changedIdx];
  const pageIndex = changed.page_index ?? 0;
  const columnIndex = (changed as any).column_index ?? 0;
  const pageDim = pageDimensions.find((p) => p.page_index === pageIndex);
  const pageHeight = pageDim?.height ?? 841.89;
  const bottomMargin = 56; // 56pt (~20mm) bottom margin

  // Step 1: Get actual rendered height from Fabric Textbox
  const canvas = canvases.get(pageIndex);
  let newHeight = (changed.bounding_box[3] - changed.bounding_box[1]);
  if (canvas) {
    const fabricObj = canvas.getObjects().find(
      (o) => (o as any).data?.blockId === changedBlockId
    ) as Textbox | undefined;
    if (fabricObj) {
      // calcTextHeight returns height in canvas pixels; divide by scale
      const scale = canvas.width! / (pageDim?.width ?? 595.28);
      newHeight = fabricObj.calcTextHeight() / scale + 4; // +4pt padding
    }
  }

  const oldHeight = changed.bounding_box[3] - changed.bounding_box[1];
  const deltaY = newHeight - oldHeight;

  if (Math.abs(deltaY) < 0.5) return model; // No meaningful change

  // Step 2: Update the changed block's own bounding box
  blocks[changedIdx] = {
    ...changed,
    bounding_box: [
      changed.bounding_box[0],
      changed.bounding_box[1],
      changed.bounding_box[2],
      changed.bounding_box[1] + newHeight,
    ] as [number, number, number, number],
  };

  // Step 3: Shift all blocks below it on the same page+column
  for (let i = 0; i < blocks.length; i++) {
    if (i === changedIdx) continue;
    const b = blocks[i];
    if (
      (b.page_index ?? 0) !== pageIndex ||
      ((b as any).column_index ?? 0) !== columnIndex
    ) continue;
    if (b.bounding_box[1] <= changed.bounding_box[1]) continue; // Above changed block

    const newY0 = b.bounding_box[1] + deltaY;
    const newY1 = b.bounding_box[3] + deltaY;

    // Step 4: Overflow — block extends past bottom margin
    if (newY1 > pageHeight - bottomMargin) {
      const overflowBlock = overflowToNextPage(b, newY0, newY1, pageHeight, bottomMargin, pageDimensions);
      blocks[i] = overflowBlock;
    } else {
      blocks[i] = {
        ...b,
        bounding_box: [b.bounding_box[0], newY0, b.bounding_box[2], newY1] as [number, number, number, number],
      };
    }
  }

  return { ...model, blocks };
}

function overflowToNextPage(
  block: DocumentBlock,
  newY0: number,
  newY1: number,
  pageHeight: number,
  bottomMargin: number,
  pageDimensions: { page_index: number; width: number; height: number }[]
): DocumentBlock {
  const nextPageIndex = (block.page_index ?? 0) + 1;
  const nextPage = pageDimensions.find((p) => p.page_index === nextPageIndex);
  const topMargin = 56;

  // If no next page exists in dimensions, it's a new page — caller handles creation
  const topY = topMargin;
  const blockHeight = newY1 - newY0;

  return {
    ...block,
    page_index: nextPageIndex,
    bounding_box: [
      block.bounding_box[0],
      topY,
      block.bounding_box[2],
      topY + blockHeight,
    ] as [number, number, number, number],
  };
}
```

### 8.4 Integration — FidelityCanvas

In `FidelityCanvas.tsx`, wire reflow into the `object:modified` handler:

```typescript
// Inside setupFabricCanvas(), after creating the canvas:
import { reflow } from "@/engine/reflow";

fcanvas.on("object:modified", (e) => {
  if (!e.target || (e.target as any).data?.blockType === "shape") {
    sync(); // existing sync
    return;
  }
  const blockId = (e.target as any).data?.blockId;
  if (!blockId) { sync(); return; }

  // Sync first so we have updated content
  syncCanvasToModel(pageIndex, fcanvas);

  // Then reflow
  const reflowed = reflow(model, blockId, fabricCanvasesRef.current, pageDimensions);
  if (reflowed !== model) {
    pushToHistory(reflowed);
    saveDebounced.current(reflowed);
    // Re-position moved blocks in their canvases
    applyReflowToCanvases(reflowed, fabricCanvasesRef.current, scale);
  }
});
```

```typescript
// Apply updated positions back into Fabric objects (no re-create)
function applyReflowToCanvases(
  model: DocumentModel,
  canvases: Map<number, Canvas>,
  scale: number
) {
  for (const [pageIndex, canvas] of canvases.entries()) {
    for (const obj of canvas.getObjects()) {
      const blockId = (obj as any).data?.blockId;
      if (!blockId) continue;
      const block = model.blocks?.find((b) => b.id === blockId);
      if (!block || (block.page_index ?? 0) !== pageIndex) continue;
      const [x0, y0, x1, y1] = block.bounding_box;
      obj.set({ left: x0 * scale, top: y0 * scale });
      if (obj.type === "textbox") {
        (obj as Textbox).set({ width: (x1 - x0) * scale });
      }
    }
    canvas.renderAll();
  }
}
```

### 8.5 Page Overflow — Auto-creating a New Page

If `overflowToNextPage` references a `nextPageIndex` that doesn't exist in `pageDimensions`, the caller must create a new page:

```typescript
// In the reflow function, after Step 4:
const needsNewPage = blocks.some(
  (b) => (b.page_index ?? 0) >= pageDimensions.length
);
if (needsNewPage) {
  const lastDim = pageDimensions[pageDimensions.length - 1];
  const newPageDim = { page_index: lastDim.page_index + 1, width: lastDim.width, height: lastDim.height };
  return {
    ...model,
    blocks,
    page_dimensions: [...(model.page_dimensions ?? []), newPageDim],
  };
}
```

A new `<div>` with a Fabric canvas is added to the DOM automatically because `FidelityCanvas` maps over `model.page_dimensions`.

### 8.6 Column-Aware Reflow

The algorithm already handles columns via `column_index` filtering in Step 3. Blocks in column 1 are never shifted when a block in column 0 grows, unless both columns share the same vertical space. Multi-column documents reflow independently per column.

### 8.7 Debounce

Reflow is CPU-bound. Debounce the trigger at 100ms. Do not run reflow inside a `requestAnimationFrame` — it must complete synchronously before the canvas re-renders so there is no flicker.

### 8.8 Tests

- **Unit:** `reflow(model, blockId)` returns correct shifted positions for all blocks below.
- **Unit:** Overflow threshold — block at y=780 on 841pt page with bottomMargin=56 → overflows to next page at y=56.
- **Unit:** Column isolation — changing column 0 block does not shift column 1 blocks.
- **Integration:** Type 10 lines into a block, verify all blocks below shift by the correct cumulative height.
- **Integration:** Overflow creates a new page dimension entry.

---

## Phase 9 — Rich Text Editing (TipTap Inline)

**Goal:** Double-clicking a text block activates a TipTap rich text editor overlaid exactly on top of the Fabric Textbox. The user gets full browser text editing — spell check, IME, clipboard, keyboard shortcuts — without leaving the canvas.

### 9.1 Architecture

```
User double-clicks Fabric Textbox
  → Hide Fabric Textbox (opacity 0, evented false)
  → Mount <TipTapOverlay> absolutely positioned at the block's canvas coordinates
  → User edits in TipTap (full browser editing experience)
  → On blur / Escape → serialize TipTap JSON to plain text → update block.content
  → Destroy TipTap overlay
  → Show Fabric Textbox with updated text, trigger reflow
```

### 9.2 Overlay Positioning

```typescript
// apps/web/components/editor/TipTapOverlay.tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";

interface TipTapOverlayProps {
  block: DocumentBlock;
  scale: number;
  canvasLeft: number;   // Canvas element's offsetLeft in the page
  canvasTop: number;    // Canvas element's offsetTop in the page
  onCommit: (content: string, richContent: object) => void;
  onCancel: () => void;
}

export function TipTapOverlay({
  block, scale, canvasLeft, canvasTop, onCommit, onCancel
}: TipTapOverlayProps) {
  const [x0, y0, x1, y1] = block.bounding_box;
  const fm = block.font_meta ?? {};

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false }),
    ],
    content: block.content ?? "",
    autofocus: "end",
    editorProps: {
      attributes: {
        style: [
          `font-family: ${(fm.family as string) ?? "Georgia"}, serif`,
          `font-size: ${((fm.size as number) ?? 11) * scale}px`,
          `font-weight: ${(fm.is_bold as boolean) ? "bold" : "normal"}`,
          `font-style: ${(fm.is_italic as boolean) ? "italic" : "normal"}`,
          `color: ${(fm.color as string) ?? "#111111"}`,
          `text-align: ${block.alignment ?? "left"}`,
          `line-height: 1.25`,
          `outline: none`,
          `white-space: pre-wrap`,
          `word-break: break-word`,
        ].join(";"),
      },
    },
    onBlur: ({ editor }) => {
      onCommit(editor.getText(), editor.getJSON());
    },
  });

  // Escape cancels
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCancel(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div
      style={{
        position: "absolute",
        left: canvasLeft + x0 * scale,
        top: canvasTop + y0 * scale,
        width: (x1 - x0) * scale,
        minHeight: (y1 - y0) * scale,
        background: "white",
        border: "2px solid #f97316",
        borderRadius: 2,
        padding: 2,
        zIndex: 100,
        boxSizing: "border-box",
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
```

### 9.3 FidelityCanvas Integration

```typescript
// In setupFabricCanvas(), add dblclick handler:
fcanvas.on("mouse:dblclick", (e) => {
  const target = e.target;
  if (!target || target.type !== "textbox") return;
  const blockId = (target as any).data?.blockId;
  if (!blockId) return;

  // Hide the Fabric object
  target.set({ opacity: 0, evented: false });
  fcanvas.renderAll();

  // Signal to React to mount the TipTap overlay
  setActiveTipTapBlock({ blockId, pageIndex });
});
```

In the render tree, add the overlay as a sibling to each page canvas:

```tsx
{pageDimensions.map((dim) => (
  <div
    key={dim.page_index}
    className="relative mx-auto rounded-sm bg-white shadow-..."
    style={{ width: dim.width * scale, height: dim.height * scale }}
  >
    <canvas ref={...} className="absolute inset-0 z-10" />

    {activeTipTapBlock?.pageIndex === dim.page_index && (() => {
      const block = model.blocks?.find(b => b.id === activeTipTapBlock.blockId);
      if (!block) return null;
      // canvasLeft/canvasTop are 0 because the overlay is inside the page div
      return (
        <TipTapOverlay
          block={block}
          scale={scale}
          canvasLeft={0}
          canvasTop={0}
          onCommit={(text, richJson) => {
            // Update block content and rich_content
            const updatedBlocks = model.blocks!.map(b =>
              b.id === activeTipTapBlock.blockId
                ? { ...b, content: text, rich_content: richJson }
                : b
            );
            const nextModel = { ...model, blocks: updatedBlocks };
            // Restore Fabric Textbox
            restoreFabricTextbox(activeTipTapBlock.blockId, activeTipTapBlock.pageIndex, text);
            setActiveTipTapBlock(null);
            pushToHistory(nextModel);
            saveDebounced.current(nextModel);
            // Run reflow with updated height
            const reflowed = reflow(nextModel, activeTipTapBlock.blockId, fabricCanvasesRef.current, pageDimensions);
            if (reflowed !== nextModel) pushToHistory(reflowed);
          }}
          onCancel={() => {
            restoreFabricTextbox(activeTipTapBlock.blockId, activeTipTapBlock.pageIndex, block.content ?? "");
            setActiveTipTapBlock(null);
          }}
        />
      );
    })()}
  </div>
))}
```

### 9.4 `rich_content` Field

Add `rich_content?: object` to the `DocumentBlock` type in `packages/document-model/`. This stores the TipTap ProseMirror JSON so formatted text (bold spans, links, lists) is preserved when re-opening the block for editing.

When the block is exported via Go service, `content` (plain text) is used — the Go exporter is unaware of `rich_content`. When the block is displayed in TipTap, `rich_content` is preferred over `content` if present.

### 9.5 List Block Types

TipTap BulletList and OrderedList nodes serialize to:
```json
{
  "type": "bulletList",
  "content": [
    { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Item 1" }] }] }
  ]
}
```

On commit, if the root node is `bulletList` or `orderedList`, set `block.type = "bullet_list"` or `"ordered_list"`. The Go export service renders list blocks by iterating items and prepending `•` or `1.` with an indent.

### 9.6 Keyboard Shortcuts Inside TipTap

TipTap handles `⌘B`, `⌘I` natively via StarterKit. Additional shortcuts:

| Shortcut | Action |
|---|---|
| `⌘K` | Insert/edit link (custom extension) |
| `⌘⇧7` | Toggle ordered list |
| `⌘⇧8` | Toggle bullet list |
| `Escape` | Commit and close |
| `⌘Enter` | Commit and close |
| `Tab` | Indent list item |
| `⇧Tab` | Outdent list item |

### 9.7 Tests

- Overlay appears at correct pixel coordinates for blocks at various positions.
- Blur commits content to block model.
- Escape cancels without modifying content.
- Bold text in TipTap → `font_meta.is_bold: true` after commit.
- List block type set correctly on commit.

---

## Phase 10 — Page Virtualization

**Goal:** A 200-page document must load in under 2 seconds and use under 300MB of memory. Only pages visible within one viewport of the current scroll position should have live Fabric canvases. All other pages show static thumbnails.

### 10.1 Architecture

```
┌─────────────────────────────────────────────────────┐
│  Scroll container (overflow-y: auto, 100vh)          │
│                                                      │
│  ┌──────────────────────────────┐  ← Viewport        │
│  │  Page 3: Fabric Canvas (live)│                    │
│  │  Page 4: Fabric Canvas (live)│                    │
│  └──────────────────────────────┘                    │
│  Page 5: <img> thumbnail                             │
│  Page 6: <img> thumbnail                             │
│  Page 7: placeholder div (not yet thumbnailed)       │
└─────────────────────────────────────────────────────┘
```

### 10.2 Implementation

```typescript
// apps/web/components/editor/VirtualizedPage.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type PageState = "placeholder" | "thumbnail" | "live";

interface VirtualizedPageProps {
  dim: { page_index: number; width: number; height: number };
  scale: number;
  model: DocumentModel;
  onCanvasReady: (pageIndex: number, el: HTMLCanvasElement) => void;
  onCanvasDestroy: (pageIndex: number) => void;
}

export function VirtualizedPage({ dim, scale, model, onCanvasReady, onCanvasDestroy }: VirtualizedPageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PageState>("placeholder");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Page is visible → mount live canvas
          setState("live");
        } else {
          // Page left viewport → capture thumbnail and destroy canvas
          if (state === "live" && canvasRef.current) {
            const url = canvasRef.current.toDataURL("image/jpeg", 0.7);
            setThumbnailUrl(url);
            onCanvasDestroy(dim.page_index);
          }
          setState("thumbnail");
        }
      },
      {
        rootMargin: "200% 0px", // Preload 1 full viewport above and below
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [state, dim.page_index]);

  const pageWidth = dim.width * scale;
  const pageHeight = dim.height * scale;

  return (
    <div
      ref={wrapperRef}
      className="relative mx-auto rounded-sm bg-white shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
      style={{ width: pageWidth, height: pageHeight }}
    >
      {state === "live" && (
        <canvas
          ref={(node) => {
            if (node && node !== canvasRef.current) {
              canvasRef.current = node;
              onCanvasReady(dim.page_index, node);
            }
          }}
          className="absolute inset-0 z-10"
        />
      )}
      {state === "thumbnail" && thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={`Page ${dim.page_index + 1}`}
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />
      )}
      {state === "placeholder" && (
        <div className="absolute inset-0 bg-gray-50 animate-pulse" />
      )}
    </div>
  );
}
```

### 10.3 Thumbnail Generation

Thumbnail capture happens in `requestIdleCallback` to avoid blocking input:

```typescript
function captureThumbnail(canvas: HTMLCanvasElement, pageIndex: number, callback: (url: string) => void) {
  const task = () => {
    const url = canvas.toDataURL("image/jpeg", 0.65);
    callback(url);
  };
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(task, { timeout: 2000 });
  } else {
    setTimeout(task, 0);
  }
}
```

Thumbnails are also stored in a `Map<number, string>` ref so that re-scrolling back to a page shows the cached thumbnail instantly without re-capturing.

### 10.4 Canvas Lifecycle

When the `IntersectionObserver` fires `isIntersecting: true`:
1. `setState("live")` → React renders `<canvas>` element
2. `onCanvasReady(pageIndex, el)` is called by the `ref` callback
3. `FidelityCanvas` calls `setupFabricCanvas(pageIndex, el, width, height)` — initializes Fabric and loads blocks

When `isIntersecting: false`:
1. `onCanvasDestroy(pageIndex)` is called
2. `FidelityCanvas` calls `canvas.dispose()` and deletes it from `fabricCanvasesRef`
3. `setState("thumbnail")` — React renders the cached `<img>`

### 10.5 Jump-to-Page

```tsx
// In the toolbar:
<input
  type="number"
  min={1}
  max={pageDimensions.length}
  className="w-14 h-7 text-xs text-center border rounded"
  placeholder="Page"
  onKeyDown={(e) => {
    if (e.key !== "Enter") return;
    const n = parseInt((e.target as HTMLInputElement).value, 10) - 1;
    const el = pageRefs.current.get(n);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }}
/>
<span className="text-xs text-[var(--text-tertiary)]">/ {pageDimensions.length}</span>
```

### 10.6 Memory Budget

| State | Memory per page |
|---|---|
| Placeholder | ~0 MB |
| Thumbnail (JPEG) | ~0.05 MB |
| Live Fabric canvas | ~2–8 MB depending on block count |

Target: at most 4 live canvases at once → max ~32 MB for canvas state.

### 10.7 Tests

- Observer correctly triggers live→thumbnail transition on scroll.
- Canvas dispose is called when page leaves viewport.
- Re-entering viewport re-initializes Fabric with correct block state (from model, not stale canvas).
- 200-page document: < 300MB memory usage, < 2s initial load.

---

## Phase 11 — Find & Replace

**Goal:** Press `Ctrl+F` from anywhere in the editor and search across all text blocks in the document. Navigate matches, replace one or all.

### 11.1 Zustand Store

```typescript
// apps/web/store/useFindReplaceStore.ts
import { create } from "zustand";

interface FindReplaceState {
  open: boolean;
  query: string;
  replacement: string;
  mode: "find" | "replace";
  matchCase: boolean;
  useRegex: boolean;
  matches: Match[];
  currentMatchIndex: number;

  setOpen: (open: boolean) => void;
  setQuery: (q: string) => void;
  setReplacement: (r: string) => void;
  setMode: (m: "find" | "replace") => void;
  setMatchCase: (v: boolean) => void;
  setUseRegex: (v: boolean) => void;
  setMatches: (m: Match[]) => void;
  setCurrentMatchIndex: (i: number) => void;
  nextMatch: () => void;
  prevMatch: () => void;
}

interface Match {
  blockId: string;
  pageIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;  // the matched substring
}

export const useFindReplaceStore = create<FindReplaceState>((set, get) => ({
  open: false,
  query: "",
  replacement: "",
  mode: "find",
  matchCase: false,
  useRegex: false,
  matches: [],
  currentMatchIndex: 0,
  setOpen: (open) => set({ open }),
  setQuery: (query) => set({ query }),
  setReplacement: (replacement) => set({ replacement }),
  setMode: (mode) => set({ mode }),
  setMatchCase: (matchCase) => set({ matchCase }),
  setUseRegex: (useRegex) => set({ useRegex }),
  setMatches: (matches) => set({ matches, currentMatchIndex: 0 }),
  setCurrentMatchIndex: (i) => set({ currentMatchIndex: i }),
  nextMatch: () => {
    const { currentMatchIndex, matches } = get();
    set({ currentMatchIndex: (currentMatchIndex + 1) % matches.length });
  },
  prevMatch: () => {
    const { currentMatchIndex, matches } = get();
    set({ currentMatchIndex: (currentMatchIndex - 1 + matches.length) % matches.length });
  },
}));
```

### 11.2 Search Algorithm

```typescript
// apps/web/engine/search.ts
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";

export function findMatches(
  model: DocumentModel,
  query: string,
  options: { matchCase: boolean; useRegex: boolean }
): Match[] {
  if (!query) return [];

  const matches: Match[] = [];
  const blocks = [...(model.blocks ?? [])].sort((a, b) => {
    if ((a.page_index ?? 0) !== (b.page_index ?? 0))
      return (a.page_index ?? 0) - (b.page_index ?? 0);
    return (a.bounding_box[1] ?? 0) - (b.bounding_box[1] ?? 0);
  });

  let pattern: RegExp;
  try {
    pattern = options.useRegex
      ? new RegExp(query, options.matchCase ? "g" : "gi")
      : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), options.matchCase ? "g" : "gi");
  } catch {
    return [];
  }

  for (const block of blocks) {
    if (!block.content || block.type === "table") continue;
    const text = block.content;
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        blockId: block.id,
        pageIndex: block.page_index ?? 0,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        text: match[0],
      });
      if (match[0].length === 0) pattern.lastIndex++; // Prevent infinite loop on empty match
    }
  }

  return matches;
}

export function replaceMatch(
  model: DocumentModel,
  match: Match,
  replacement: string
): DocumentModel {
  const blocks = (model.blocks ?? []).map((b) => {
    if (b.id !== match.blockId) return b;
    const newContent =
      b.content!.slice(0, match.startOffset) +
      replacement +
      b.content!.slice(match.endOffset);
    return { ...b, content: newContent };
  });
  return { ...model, blocks };
}

export function replaceAll(
  model: DocumentModel,
  matches: Match[],
  replacement: string
): DocumentModel {
  // Process matches in reverse order to preserve offsets
  const sortedDesc = [...matches].sort((a, b) => {
    if (a.blockId !== b.blockId) return a.blockId.localeCompare(b.blockId);
    return b.startOffset - a.startOffset;
  });

  let result = model;
  for (const match of sortedDesc) {
    result = replaceMatch(result, match, replacement);
  }
  return result;
}
```

### 11.3 Highlight Overlay

Matches are highlighted by rendering a semi-transparent orange `Rect` over the matching text inside each Fabric canvas. This avoids modifying the Textbox text.

```typescript
// In FidelityCanvas, react to findReplaceStore.matches:
useEffect(() => {
  // Clear old highlight rects
  for (const [, canvas] of fabricCanvasesRef.current.entries()) {
    const highlights = canvas.getObjects().filter((o) => (o as any).data?.isHighlight);
    canvas.remove(...highlights);
  }

  if (!matches.length) return;

  for (const match of matches) {
    const canvas = fabricCanvasesRef.current.get(match.pageIndex);
    if (!canvas) continue;

    const block = model.blocks?.find((b) => b.id === match.blockId);
    if (!block) continue;

    const isCurrent = matches[currentMatchIndex]?.blockId === match.blockId &&
                      matches[currentMatchIndex]?.startOffset === match.startOffset;

    const [x0, y0, x1, y1] = block.bounding_box;
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
    canvas.renderAll();
  }
}, [matches, currentMatchIndex, scale]);
```

### 11.4 FindReplaceBar Component

```tsx
// apps/web/components/editor/FindReplaceBar.tsx
// Floats at top of editor, below the main toolbar, above FormatBar.
// Does NOT block the canvas — it overlays as position:sticky or fixed.

"use client";
import { useEffect, useRef } from "react";
import { useFindReplaceStore } from "@/store/useFindReplaceStore";
import { findMatches, replaceMatch, replaceAll } from "@/engine/search";

export function FindReplaceBar({ model, onModelChange }) {
  const store = useFindReplaceStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+F opens bar, Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        store.setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        store.setOpen(true);
        store.setMode("replace");
      }
      if (e.key === "Escape") store.setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Re-run search on query change
  useEffect(() => {
    if (!store.open || !store.query) { store.setMatches([]); return; }
    const matches = findMatches(model, store.query, {
      matchCase: store.matchCase,
      useRegex: store.useRegex,
    });
    store.setMatches(matches);
  }, [store.query, store.matchCase, store.useRegex, store.open, model]);

  if (!store.open) return null;

  return (
    <div className="sticky top-[60px] z-50 mx-auto w-full max-w-[1200px]">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 shadow-lg">
        {/* Find input */}
        <input
          ref={inputRef}
          type="text"
          placeholder="Find..."
          value={store.query}
          onChange={(e) => store.setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.shiftKey ? store.prevMatch() : store.nextMatch(); }}
          className="flex-1 h-7 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-2 text-xs focus:outline-none"
        />

        {/* Match counter */}
        <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 w-16 text-center">
          {store.matches.length > 0
            ? `${store.currentMatchIndex + 1} / ${store.matches.length}`
            : store.query ? "No results" : ""}
        </span>

        {/* Navigate */}
        <button onClick={store.prevMatch} className="px-2 py-1 text-xs hover:bg-[var(--bg-glass-subtle)] rounded">↑</button>
        <button onClick={store.nextMatch} className="px-2 py-1 text-xs hover:bg-[var(--bg-glass-subtle)] rounded">↓</button>

        {/* Options */}
        <button
          onClick={() => store.setMatchCase(!store.matchCase)}
          className={`px-2 py-1 text-[10px] font-bold rounded ${store.matchCase ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--bg-glass-subtle)]"}`}
          title="Match case"
        >Aa</button>
        <button
          onClick={() => store.setUseRegex(!store.useRegex)}
          className={`px-2 py-1 text-[10px] font-mono rounded ${store.useRegex ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--bg-glass-subtle)]"}`}
          title="Use regex"
        >.*</button>

        {/* Replace toggle */}
        <button
          onClick={() => store.setMode(store.mode === "replace" ? "find" : "replace")}
          className="px-2 py-1 text-[10px] hover:bg-[var(--bg-glass-subtle)] rounded"
        >{store.mode === "replace" ? "Hide Replace" : "Replace"}</button>

        {store.mode === "replace" && (
          <>
            <input
              type="text"
              placeholder="Replace with..."
              value={store.replacement}
              onChange={(e) => store.setReplacement(e.target.value)}
              className="flex-1 h-7 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-2 text-xs"
            />
            <button
              onClick={() => {
                const match = store.matches[store.currentMatchIndex];
                if (!match) return;
                const next = replaceMatch(model, match, store.replacement);
                onModelChange(next);
              }}
              className="px-2 py-1 text-xs bg-[var(--accent)] text-white rounded hover:opacity-90"
            >Replace</button>
            <button
              onClick={() => {
                const next = replaceAll(model, store.matches, store.replacement);
                onModelChange(next);
              }}
              className="px-2 py-1 text-xs bg-[var(--accent)] text-white rounded hover:opacity-90"
            >All</button>
          </>
        )}

        <button onClick={() => store.setOpen(false)} className="px-2 py-1 text-xs hover:bg-[var(--bg-glass-subtle)] rounded">✕</button>
      </div>
    </div>
  );
}
```

### 11.5 Tests

- `findMatches` returns correct offsets for overlapping matches.
- `replaceAll` correctly handles multiple matches in the same block (reverse order).
- Regex errors are caught and return empty matches.
- Highlight rects appear on correct canvas pages.
- `Ctrl+F` opens bar, `Escape` closes without state leak.

---

## Phase 12 — Comments & Annotations

**Goal:** Any user can highlight a text block or page region and attach a comment thread. Comments are stored in Supabase, shown as indicators on the canvas, and exportable as PDF popup annotations.

### 12.1 Database Schema

```sql
CREATE TABLE document_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_id   UUID REFERENCES document_comments(id) ON DELETE CASCADE,
  block_id    TEXT,           -- block.id from DocumentModel; null = page-level comment
  page_index  INTEGER NOT NULL,
  anchor      JSONB,          -- { startOffset: number, endOffset: number } for text anchors
  position    JSONB NOT NULL, -- { x, y, width, height } in PDF points for pin placement
  body        TEXT NOT NULL,
  resolved    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_document ON document_comments(document_id);
CREATE INDEX idx_comments_block ON document_comments(block_id);

-- RLS: workspace members can read; authors can update/delete their own
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;
```

### 12.2 FastAPI Router

```python
# apps/api/routes/comments.py
from fastapi import APIRouter, Depends
from ..core.auth import get_current_user
from ..core.supabase_client import supabase
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter(prefix="/documents/{doc_id}/comments", tags=["comments"])

class CommentCreate(BaseModel):
    block_id: Optional[str] = None
    page_index: int
    anchor: Optional[dict] = None
    position: dict
    body: str
    parent_id: Optional[str] = None

@router.get("/")
async def list_comments(doc_id: str, user=Depends(get_current_user)):
    res = supabase.table("document_comments") \
        .select("*, created_by_profile:auth.users(email, raw_user_meta_data)") \
        .eq("document_id", doc_id) \
        .order("created_at") \
        .execute()
    return res.data

@router.post("/")
async def create_comment(doc_id: str, body: CommentCreate, user=Depends(get_current_user)):
    res = supabase.table("document_comments").insert({
        "id": str(uuid.uuid4()),
        "document_id": doc_id,
        "created_by": user["user_id"],
        **body.dict(),
    }).execute()
    return res.data[0]

@router.patch("/{comment_id}/resolve")
async def resolve_comment(doc_id: str, comment_id: str, user=Depends(get_current_user)):
    supabase.table("document_comments").update({"resolved": True}).eq("id", comment_id).execute()
    return {"ok": True}

@router.delete("/{comment_id}")
async def delete_comment(doc_id: str, comment_id: str, user=Depends(get_current_user)):
    supabase.table("document_comments").delete().eq("id", comment_id).eq("created_by", user["user_id"]).execute()
    return {"ok": True}
```

### 12.3 Frontend — Comment Indicators

Each page canvas renders comment indicator dots on its right edge. Clicking a dot opens the thread panel.

```typescript
// In FidelityCanvas.tsx, after loading canvas:
// Draw comment indicators as small Fabric circles on the right margin

function renderCommentIndicators(canvas: Canvas, comments: Comment[], pageIndex: number, scale: number) {
  const existing = canvas.getObjects().filter((o) => (o as any).data?.isCommentIndicator);
  canvas.remove(...existing);

  const pageComments = comments.filter((c) => c.page_index === pageIndex && !c.resolved);
  const byBlock = new Map<string, Comment[]>();
  for (const c of pageComments) {
    const key = c.block_id ?? `page_${pageIndex}`;
    byBlock.set(key, [...(byBlock.get(key) ?? []), c]);
  }

  for (const [key, group] of byBlock.entries()) {
    const y = (group[0].position?.y ?? 50) * scale;
    const circle = new Circle({
      left: canvas.width! - 20,
      top: y,
      radius: 8,
      fill: "#f97316",
      selectable: false,
      evented: true,
      hoverCursor: "pointer",
    });
    (circle as any).data = { isCommentIndicator: true, blockId: key, commentIds: group.map(c => c.id) };
    circle.on("mousedown", () => setOpenCommentThread(key));
    canvas.add(circle);
  }
  canvas.renderAll();
}
```

### 12.4 Comment Sidebar

```tsx
// apps/web/components/editor/CommentSidebar.tsx
// Shows threaded comments for the currently open thread (openCommentThread key).
// Reply box at the bottom. Resolve button in thread header.
```

### 12.5 Export: PDF Popup Annotations

In the Go export service, add a `/export/annotated` endpoint that:
1. Accepts the DocumentModel + list of comment records.
2. For each comment, uses fpdf's `Link` or a text annotation approximation.
3. In a full implementation, use the `pdfcpu` Go library (or call PyMuPDF) to embed proper `Popup` annotations with `Contents` field.

```go
// For now: add comment text as a small IText near the annotated block
// Full PDF annotation support requires pdfcpu integration (Phase 19 concern)
```

### 12.6 Tests

- `create_comment` inserts correctly with RLS checks.
- Comment indicators appear at correct y-position on canvas.
- Resolve hides indicator without deleting the thread.
- Parent/child comment threading: replies have `parent_id` set.

---

## Phase 13 — Real-time Collaboration (Full Yjs)

**Goal:** Multiple users editing the same document simultaneously see each other's changes instantly. All block operations — text edits, moves, resizes, format changes, additions, deletions — are CRDT-synced via Yjs.

### 13.1 Yjs Document Structure

```typescript
// ydoc structure:
// ydoc.getMap("blocks")           → Y.Map<string, Y.Map<string, any>>
//   Each key = block.id
//   Each value = Y.Map with all block fields as entries
//
// ydoc.getMap("page_dimensions")  → Y.Map<string, Y.Map<string, number>>
//
// ydoc.getArray("block_order")    → Y.Array<string> (ordered list of block IDs per page)
//
// ydoc.getMap("awareness_states") → handled by y-supabase provider

import * as Y from "yjs";

function initYDoc(model: DocumentModel): Y.Doc {
  const ydoc = new Y.Doc();
  const yBlocks = ydoc.getMap<Y.Map<any>>("blocks");

  ydoc.transact(() => {
    for (const block of model.blocks ?? []) {
      const yBlock = new Y.Map<any>();
      for (const [k, v] of Object.entries(block)) {
        yBlock.set(k, v);
      }
      yBlocks.set(block.id, yBlock);
    }
  });

  return ydoc;
}
```

### 13.2 Yjs Provider — y-supabase

```typescript
// apps/web/hooks/useCollaboration.ts
import * as Y from "yjs";
import { SupabaseProvider } from "y-supabase";
import { createClient } from "@/lib/supabase/client";

export function useCollaboration(documentId: string, model: DocumentModel) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<SupabaseProvider | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const ydoc = initYDoc(model);
    ydocRef.current = ydoc;

    const provider = new SupabaseProvider(ydoc, supabase, {
      channel: `document:${documentId}`,
      tableName: "yjs_updates",       // See schema below
      columnName: "data",
      docId: documentId,
    });
    providerRef.current = provider;

    // Awareness: broadcast current user + selected block
    provider.awareness.setLocalStateField("user", {
      id: currentUser.id,
      name: currentUser.email,
      color: generateColor(currentUser.id),
      selectedBlockId: null,
    });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [documentId]);

  return { ydocRef, providerRef };
}
```

```sql
-- Supabase table for Yjs updates
CREATE TABLE yjs_updates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  data        BYTEA NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_yjs_updates_document ON yjs_updates(document_id);
ALTER TABLE yjs_updates ENABLE ROW LEVEL SECURITY;
```

### 13.3 Fabric ↔ Yjs Bridge

Every Fabric `object:modified` event writes to the Yjs doc. Every Yjs observer applies changes to the Fabric canvas:

```typescript
// WRITE: Fabric → Yjs
fcanvas.on("object:modified", (e) => {
  if (!e.target) return;
  const blockId = (e.target as any).data?.blockId;
  if (!blockId || !ydocRef.current) return;

  const yBlocks = ydocRef.current.getMap<Y.Map<any>>("blocks");
  const yBlock = yBlocks.get(blockId);
  if (!yBlock) return;

  // Sync position and content
  const obj = e.target;
  const left = (obj.left ?? 0) / scale;
  const top = (obj.top ?? 0) / scale;
  const w = ((obj.width ?? 0) * (obj.scaleX ?? 1)) / scale;
  const h = ((obj.height ?? 0) * (obj.scaleY ?? 1)) / scale;

  ydocRef.current.transact(() => {
    yBlock.set("bounding_box", [left, top, left + w, top + h]);
    if (obj.type === "textbox") {
      yBlock.set("content", (obj as Textbox).text ?? "");
    }
  });
});

// READ: Yjs → Fabric
const yBlocks = ydocRef.current.getMap<Y.Map<any>>("blocks");
yBlocks.observeDeep((events) => {
  for (const event of events) {
    if (!(event instanceof Y.YMapEvent)) continue;
    const blockId = event.target === yBlocks
      ? Array.from(event.changes.keys.keys())[0]
      : getBlockIdFromPath(event.path);

    if (!blockId) continue;
    const yBlock = yBlocks.get(blockId);
    if (!yBlock) continue;

    // Find the Fabric object and update it
    for (const [pageIndex, canvas] of fabricCanvasesRef.current.entries()) {
      const obj = canvas.getObjects().find(o => (o as any).data?.blockId === blockId);
      if (!obj) continue;

      const bbox = yBlock.get("bounding_box") as number[];
      if (bbox) {
        obj.set({ left: bbox[0] * scale, top: bbox[1] * scale });
      }
      if (obj.type === "textbox") {
        const content = yBlock.get("content") as string;
        if (content !== undefined && (obj as Textbox).text !== content) {
          (obj as Textbox).set("text", content);
        }
      }
      canvas.renderAll();
    }
  }
});
```

### 13.4 Presence — User Cursors

```typescript
// Broadcast selected block on selection change:
fcanvas.on("selection:created", () => {
  const obj = fcanvas.getActiveObject();
  const blockId = obj ? (obj as any).data?.blockId : null;
  providerRef.current?.awareness.setLocalStateField("user", {
    ...providerRef.current.awareness.getLocalState()?.user,
    selectedBlockId: blockId,
  });
});

// Render other users' selections as colored borders:
providerRef.current?.awareness.on("change", () => {
  const states = Array.from(providerRef.current!.awareness.getStates().entries());
  for (const [clientId, state] of states) {
    if (clientId === providerRef.current!.awareness.clientID) continue;
    const { color, selectedBlockId } = state.user ?? {};
    if (!selectedBlockId) continue;
    // Find the Fabric object and add a colored border indicator
    for (const [, canvas] of fabricCanvasesRef.current.entries()) {
      const obj = canvas.getObjects().find(o => (o as any).data?.blockId === selectedBlockId);
      if (obj) {
        obj.set({ borderColor: color, borderScaleFactor: 2 });
        canvas.renderAll();
      }
    }
  }
});
```

### 13.5 Conflict Resolution

Yjs CRDT handles this automatically. Concurrent text edits are merged at character level. Concurrent moves resolve by last-write-wins on `bounding_box`. No manual conflict resolution code is needed.

### 13.6 Offline Behaviour

`y-indexeddb` (already in package.json) persists all Yjs updates to IndexedDB. On reconnect, the provider replays buffered updates. No data loss.

```typescript
import { IndexeddbPersistence } from "y-indexeddb";
const localPersist = new IndexeddbPersistence(`olpdf-${documentId}`, ydoc);
```

### 13.7 Presence Avatars in Toolbar

```tsx
// Show up to 5 collaborator avatars in the editor toolbar
const awarenessStates = useAwarenessStates(providerRef.current);
const others = awarenessStates.filter(([id]) => id !== localClientId);

<div className="flex -space-x-2 ml-auto">
  {others.slice(0, 5).map(([id, state]) => (
    <div
      key={id}
      title={state.user?.name}
      className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white"
      style={{ backgroundColor: state.user?.color }}
    >
      {(state.user?.name ?? "?")[0].toUpperCase()}
    </div>
  ))}
  {others.length > 5 && (
    <div className="w-7 h-7 rounded-full bg-gray-400 border-2 border-white flex items-center justify-center text-[9px] text-white font-bold">
      +{others.length - 5}
    </div>
  )}
</div>
```

---

## Phase 14 — Track Changes

**Goal:** "Suggest Mode" — edits appear as colored diffs. Accept or reject individual changes. Full version snapshot history in Supabase.

### 14.1 Suggest Mode Toggle

```typescript
// Add to useFidelityCanvasStore:
suggestMode: boolean;
toggleSuggestMode: () => void;
```

When `suggestMode` is `true`, changes to Fabric Textboxes do not immediately commit to the block model. Instead they are captured as a `ChangeRecord`.

### 14.2 ChangeRecord Type

```typescript
interface ChangeRecord {
  id: string;             // uuid
  blockId: string;
  field: "content" | "bounding_box" | "font_meta" | "alignment";
  oldValue: unknown;
  newValue: unknown;
  userId: string;
  userName: string;
  timestamp: number;      // Date.now()
  status: "pending" | "accepted" | "rejected";
}
```

### 14.3 Change Capture — Text Diffs

On `object:modified` in suggest mode, compute the diff:

```typescript
import { diffWords } from "diff";  // npm package: diff

function captureTextChange(blockId: string, oldText: string, newText: string): ChangeRecord {
  return {
    id: crypto.randomUUID(),
    blockId,
    field: "content",
    oldValue: oldText,
    newValue: newText,
    userId: currentUser.id,
    userName: currentUser.email,
    timestamp: Date.now(),
    status: "pending",
  };
}
```

### 14.4 Visual Rendering — Tracked Changes in Fabric

In suggest mode, text blocks render with change markup. Since Fabric Textbox doesn't support mixed inline styles on arbitrary text ranges, use the TipTap overlay approach for suggest mode rendering:

For each pending change on a text block:
1. Open TipTap on that block's position.
2. Set TipTap content to: deleted text as `<s style="color:red">` + inserted text as `<u style="color:green">`.
3. The overlay is read-only (not editable) — it's a rendering layer.

This is a pragmatic approach that avoids reimplementing a full diff renderer on Fabric canvas.

### 14.5 Accept / Reject

```typescript
function acceptChange(change: ChangeRecord, model: DocumentModel): DocumentModel {
  const blocks = model.blocks!.map((b) => {
    if (b.id !== change.blockId) return b;
    return { ...b, [change.field]: change.newValue };
  });
  return { ...model, blocks };
}

function rejectChange(change: ChangeRecord, model: DocumentModel): DocumentModel {
  // Revert to oldValue — no-op since we haven't committed the change in suggest mode
  return model;
}
```

### 14.6 Version Snapshots

```python
# apps/api/services/version_service.py
async def create_version_snapshot(doc_id: str, model: dict, user_id: str, label: str = None):
    # Get current version number
    doc = supabase.table("documents").select("version").eq("id", doc_id).single().execute()
    version_num = doc.data["version"]

    supabase.table("document_versions").insert({
        "document_id": doc_id,
        "version_number": version_num,
        "document_model": model,
        "created_by": user_id,
        "label": label,
    }).execute()

# Auto-snapshot: called in the PATCH /documents/{id} route every 30 versions
# or when the user explicitly clicks "Save Version"
```

### 14.7 Version History UI

```tsx
// apps/web/components/editor/VersionHistoryPanel.tsx
// Sidebar listing all snapshots with author, timestamp, label.
// Click to preview (read-only canvas overlay).
// "Restore" button sets model to that snapshot's document_model.
```

### 14.8 Diff View

```typescript
// Side-by-side diff: compare two DocumentModel versions block by block.
// For each block ID present in both versions:
//   - If content differs → show highlight
//   - If bounding_box differs → show position change indicator
// New blocks (in B but not A) → green highlight
// Deleted blocks (in A but not B) → red strikethrough in position
```

---

## Phase 15 — Smart Styles System

**Goal:** Document-level paragraph styles (Normal, Heading 1–3, Caption, Quote, Code, List). Apply a style to a block with one click. Edit a style globally — all blocks using it update instantly.

### 15.1 Style Definition Schema

```typescript
interface ParagraphStyle {
  id: string;                  // "normal" | "heading1" | "heading2" | ... | custom UUID
  name: string;                // Display name
  fontFamily: string;
  fontSize: number;            // in pt
  isBold: boolean;
  isItalic: boolean;
  color: string;               // hex
  alignment: "left" | "center" | "right" | "justify";
  lineHeight: number;          // multiplier
  marginTop: number;           // pt
  marginBottom: number;        // pt
  spaceBefore?: number;        // pt before paragraph
  spaceAfter?: number;         // pt after paragraph
}

interface DocumentStyles {
  styles: ParagraphStyle[];
}
```

Add `doc_styles: DocumentStyles` to the `documents` table:

```sql
ALTER TABLE documents ADD COLUMN doc_styles JSONB DEFAULT '{"styles": []}';
```

### 15.2 Default Styles

```typescript
export const DEFAULT_STYLES: ParagraphStyle[] = [
  { id: "normal",   name: "Normal",    fontFamily: "Georgia", fontSize: 11, isBold: false, isItalic: false, color: "#111111", alignment: "left", lineHeight: 1.25, marginTop: 4, marginBottom: 4 },
  { id: "heading1", name: "Heading 1", fontFamily: "Georgia", fontSize: 22, isBold: true,  isItalic: false, color: "#111111", alignment: "left", lineHeight: 1.2,  marginTop: 14, marginBottom: 6 },
  { id: "heading2", name: "Heading 2", fontFamily: "Georgia", fontSize: 17, isBold: true,  isItalic: false, color: "#111111", alignment: "left", lineHeight: 1.2,  marginTop: 10, marginBottom: 4 },
  { id: "heading3", name: "Heading 3", fontFamily: "Georgia", fontSize: 13, isBold: true,  isItalic: false, color: "#333333", alignment: "left", lineHeight: 1.25, marginTop: 8,  marginBottom: 3 },
  { id: "caption",  name: "Caption",   fontFamily: "Helvetica", fontSize: 9, isBold: false, isItalic: true,  color: "#666666", alignment: "center", lineHeight: 1.2, marginTop: 2, marginBottom: 2 },
  { id: "quote",    name: "Quote",     fontFamily: "Georgia", fontSize: 11, isBold: false, isItalic: true,  color: "#444444", alignment: "justify", lineHeight: 1.4, marginTop: 8, marginBottom: 8 },
  { id: "code",     name: "Code",      fontFamily: "Courier",  fontSize: 10, isBold: false, isItalic: false, color: "#1a1a1a", alignment: "left", lineHeight: 1.3, marginTop: 4, marginBottom: 4 },
];
```

### 15.3 Applying a Style to a Block

```typescript
function applyStyle(
  block: DocumentBlock,
  style: ParagraphStyle
): DocumentBlock {
  return {
    ...block,
    type: style.id as any,
    font_meta: {
      family: style.fontFamily,
      size: style.fontSize,
      is_bold: style.isBold,
      is_italic: style.isItalic,
      color: style.color,
    },
    alignment: style.alignment,
    spacing: {
      line_height: style.fontSize * style.lineHeight,
      margin_top: style.marginTop,
      margin_bottom: style.marginBottom,
    },
    applied_style_id: style.id,  // new field
  };
}
```

### 15.4 Global Style Propagation

When a style definition is edited, all blocks with `applied_style_id === style.id` update:

```typescript
function propagateStyleChange(
  model: DocumentModel,
  updatedStyle: ParagraphStyle
): DocumentModel {
  const blocks = model.blocks!.map((b) => {
    if ((b as any).applied_style_id !== updatedStyle.id) return b;
    return applyStyle(b, updatedStyle);
  });
  return { ...model, blocks };
}
```

### 15.5 Style Picker in FormatBar

```tsx
// Add a style dropdown to FormatBar.tsx, before the font family selector:
<select
  value={(selectedBlock as any)?.appliedStyleId ?? ""}
  onChange={(e) => {
    const style = docStyles.find(s => s.id === e.target.value);
    if (!style) return;
    applyFormat({ styleId: style.id });
  }}
  className="h-7 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-1.5 text-xs max-w-[110px]"
>
  <option value="">Style...</option>
  {docStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
</select>
```

### 15.6 Style Inference on Import

In `extractor.py`, after extracting blocks, infer `applied_style_id` by comparing `font_meta` to default styles:

```python
def _infer_applied_style(block: dict, default_styles: list) -> str:
    """Match block font_meta to the closest default style by font_size and is_bold."""
    fm = block.get("font_meta") or {}
    size = fm.get("size", 11)
    is_bold = fm.get("is_bold", False)
    block_type = block.get("type", "paragraph")

    # Direct type-to-style mapping
    type_to_style = {
        "heading1": "heading1", "heading2": "heading2", "heading3": "heading3",
        "paragraph": "normal", "list": "normal", "bullet_list": "normal",
    }
    return type_to_style.get(block_type, "normal")
```

---

## Phase 16 — AI Content Tools

**Goal:** AI editing tools integrated directly into the canvas — rewrite, improve, shorten, OCR correction, summarize — all server-side, no API keys in the browser.

### 16.1 FastAPI AI Routes

```python
# apps/api/routes/ai.py
from anthropic import Anthropic

client = Anthropic()

@router.post("/{doc_id}/blocks/{block_id}/rewrite")
async def rewrite_block(
    doc_id: str, block_id: str,
    instruction: str,     # "improve", "shorten", "formal", "casual", custom
    user=Depends(get_current_user)
):
    """Rewrite a specific block's content per instruction."""
    doc = _get_doc_checked(doc_id, user)
    block = next((b for b in doc["document_model"]["blocks"] if b["id"] == block_id), None)
    if not block:
        raise HTTPException(404, "Block not found")

    prompts = {
        "improve":  "Improve the writing quality. Keep the same meaning and length.",
        "shorten":  "Shorten to 50% of the original length. Keep key information.",
        "formal":   "Rewrite in formal professional tone.",
        "casual":   "Rewrite in conversational casual tone.",
    }
    system_prompt = prompts.get(instruction, instruction)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=f"You are a writing assistant. {system_prompt} Return ONLY the rewritten text, no commentary.",
        messages=[{"role": "user", "content": block["content"]}]
    )
    return {"suggestion": response.content[0].text, "original": block["content"]}


@router.post("/{doc_id}/summarise")
async def summarise_document(doc_id: str, user=Depends(get_current_user)):
    """Generate a 3-sentence executive summary of the full document."""
    doc = _get_doc_checked(doc_id, user)
    text = _flatten_document_text(doc["document_model"])

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": f"Summarise this document in exactly 3 concise sentences:\n\n{text[:30000]}"
        }]
    )
    return {"summary": response.content[0].text}


@router.post("/{doc_id}/blocks/{block_id}/ocr-verify")
async def verify_ocr_block(doc_id: str, block_id: str, user=Depends(get_current_user)):
    """Use GPT-4o Vision to verify/correct OCR text against the original page image."""
    doc = _get_doc_checked(doc_id, user)
    block = next((b for b in doc["document_model"]["blocks"] if b["id"] == block_id), None)
    if not block or block.get("confidence_score", 1.0) >= 0.9:
        return {"verified": True, "correction": None}

    # Crop the original page image to the block's bounding box
    page_image_bytes = await _crop_block_from_original_pdf(doc, block)

    import base64
    image_b64 = base64.standard_b64encode(page_image_bytes).decode()

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_b64}},
                {"type": "text", "text": f"The OCR extracted this text from the image: \"{block['content']}\"\n\nIs this correct? If not, provide the correct text. Reply with JSON: {{\"correct\": true}} or {{\"correct\": false, \"corrected\": \"...\"}}"}
            ]
        }]
    )

    import json
    result = json.loads(response.content[0].text)
    return {"verified": result.get("correct"), "correction": result.get("corrected")}


def _flatten_document_text(model: dict) -> str:
    return "\n\n".join(
        b.get("content", "") for b in model.get("blocks", [])
        if b.get("content") and b.get("type") != "table"
    )
```

### 16.2 Frontend AI Toolbar

Right-click context menu on any text block:

```tsx
// apps/web/components/editor/BlockContextMenu.tsx
<ContextMenu>
  <ContextMenuItem onClick={() => aiRewrite(blockId, "improve")}>✨ Improve Writing</ContextMenuItem>
  <ContextMenuItem onClick={() => aiRewrite(blockId, "shorten")}>✂️ Make Shorter</ContextMenuItem>
  <ContextMenuItem onClick={() => aiRewrite(blockId, "formal")}>👔 Make Formal</ContextMenuItem>
  <ContextMenuItem onClick={() => aiRewrite(blockId, "casual")}>😊 Make Casual</ContextMenuItem>
  {block.confidence_score < 0.9 && (
    <ContextMenuItem onClick={() => ocRVerify(blockId)}>🔍 Verify OCR</ContextMenuItem>
  )}
</ContextMenu>
```

AI suggestion appears as a tracked change (Phase 14) — the user can accept or reject it.

```typescript
async function aiRewrite(blockId: string, instruction: string) {
  const res = await fetch(`/api/documents/${documentId}/blocks/${blockId}/rewrite`, {
    method: "POST",
    body: JSON.stringify({ instruction }),
    headers: { "Content-Type": "application/json" },
  });
  const { suggestion, original } = await res.json();

  // Insert as a tracked change (Phase 14)
  addPendingChange({
    id: crypto.randomUUID(),
    blockId,
    field: "content",
    oldValue: original,
    newValue: suggestion,
    userId: currentUser.id,
    userName: currentUser.email + " (AI)",
    timestamp: Date.now(),
    status: "pending",
  });
}
```

### 16.3 OCR Review Badge

Blocks with `confidence_score < 0.9` display a small amber badge:

```tsx
// In FidelityCanvas, render a badge overlay for low-confidence blocks:
if (block.confidence_score < 0.9) {
  const badge = new IText("⚠", {
    left: x1 * scale + 2,
    top: y0 * scale,
    fontSize: 10,
    fill: "#f59e0b",
    selectable: false,
    evented: true,
    hoverCursor: "pointer",
  });
  (badge as any).data = { isOcrBadge: true, blockId: block.id };
  badge.on("mousedown", () => triggerOcrVerify(block.id));
  canvas.add(badge);
}
```

---

## Phase 17 — Fillable Forms

**Goal:** Toggle any text block into a form field. Generate a shareable fill-view URL where respondents fill the form in their browser. Submissions stored in Supabase.

### 17.1 Field Block Type

```typescript
interface FormFieldBlock extends DocumentBlock {
  type: "field";
  field_type: "text" | "multiline" | "checkbox" | "radio" | "select" | "date" | "signature";
  field_id: string;       // Unique field identifier within the form
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];     // For select/radio
  default_value?: string;
  validation?: {
    pattern?: string;     // regex
    min?: number;
    max?: number;
  };
}
```

### 17.2 Form Mode Toggle

```typescript
// useFidelityCanvasStore:
formMode: boolean;
toggleFormMode: () => void;

convertBlockToField: (blockId: string, fieldType: FormFieldBlock["field_type"]) => void;
```

`convertBlockToField` changes `block.type` from `"paragraph"` (or any type) to `"field"`, adds `field_id`, `label` (from content), and removes the content (it becomes the placeholder).

### 17.3 Form Canvas Renderer

In `setupFabricCanvas`, form fields are rendered differently from text blocks:

```typescript
function createFieldBlock(block: FormFieldBlock, scale: number): IText | Rect {
  const [x0, y0, x1, y1] = block.bounding_box;
  const w = (x1 - x0) * scale;
  const h = Math.max((y1 - y0) * scale, 24);

  // Render a styled input-like rect with label
  const fieldRect = new Rect({
    left: x0 * scale, top: y0 * scale,
    width: w, height: h,
    fill: "rgba(249,115,22,0.06)",
    stroke: "#f97316",
    strokeWidth: 1.5,
    strokeDashArray: [4, 2],
    rx: 4, ry: 4,
    selectable: true,
  });
  (fieldRect as any).data = { blockId: block.id, blockType: "field", fieldType: block.field_type };
  return fieldRect;
}
```

### 17.4 Fill View Page

A separate Next.js route `/documents/[id]/fill` renders the document in fill mode:

```tsx
// apps/web/app/documents/[id]/fill/page.tsx
// Renders pages as static images (from PDF page renders)
// Overlays <input> / <textarea> / <select> elements at each field's bounding box position
// On submit, POST to /api/forms/{formId}/submit

export default async function FillPage({ params }) {
  const form = await fetchForm(params.id);
  return <FormFillCanvas form={form} />;
}
```

```tsx
// FormFillCanvas.tsx — renders field inputs overlaid on page images
function FormFillCanvas({ form }) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await fetch(`/api/forms/${form.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ data: values }),
      headers: { "Content-Type": "application/json" },
    });
    // Show success state
  };

  return (
    <form onSubmit={handleSubmit}>
      {form.pages.map(page => (
        <div key={page.page_index} className="relative" style={{ width: page.width * scale, height: page.height * scale }}>
          <img src={page.thumbnailUrl} className="absolute inset-0 w-full h-full" />
          {page.fields.map(field => (
            <FieldInput
              key={field.field_id}
              field={field}
              scale={scale}
              value={values[field.field_id] ?? ""}
              onChange={(v) => setValues(prev => ({ ...prev, [field.field_id]: v }))}
            />
          ))}
        </div>
      ))}
      <button type="submit" className="mt-4 px-6 py-2 bg-[var(--accent)] text-white rounded-lg">Submit</button>
    </form>
  );
}
```

### 17.5 Submission Storage

```python
@router.post("/{doc_id}/forms/submit")
async def submit_form(doc_id: str, data: dict, request: Request):
    form = supabase.table("forms").select("id").eq("document_id", doc_id).eq("is_active", True).single().execute()
    supabase.table("form_submissions").insert({
        "form_id": form.data["id"],
        "data": data,
        "ip_address": request.client.host,
        "submitted_at": "now()",
    }).execute()
    return {"ok": True}
```

### 17.6 Export with Field Values

Go export service: field blocks render their `default_value` or empty rect, depending on export mode (`blank` = empty form, `filled` = with submission values).

---

## Phase 18 — Offline-First PWA

**Goal:** OLPDF works with no internet. Changes made offline are queued and synced automatically when the connection returns.

### 18.1 Service Worker

```typescript
// apps/web/public/sw.js
// Built using Workbox (integrated via next-pwa or custom)

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from "workbox-strategies";
import { BackgroundSyncPlugin } from "workbox-background-sync";

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// App shell (HTML, JS, CSS) — cache first
registerRoute(
  ({ request }) => request.destination === "document" || request.destination === "script" || request.destination === "style",
  new CacheFirst({ cacheName: "app-shell-v1" })
);

// API reads — network first, fall back to cache
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/documents"),
  new NetworkFirst({ cacheName: "api-v1", networkTimeoutSeconds: 3 })
);

// Background sync for document saves
const bgSyncPlugin = new BackgroundSyncPlugin("document-saves-queue", {
  maxRetentionTime: 24 * 60, // 24 hours
});
registerRoute(
  ({ url, request }) => url.pathname.startsWith("/api/documents") && request.method === "PATCH",
  new NetworkFirst({ plugins: [bgSyncPlugin] }),
  "PATCH"
);
```

### 18.2 next.config.ts Integration

```typescript
// apps/web/next.config.ts — add PWA support
import withPWA from "next-pwa";

const withPWAConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

export default withPWAConfig({
  // ... existing config
});
```

### 18.3 Offline Indicator

```tsx
// apps/web/components/OfflineIndicator.tsx
"use client";
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const on = () => setOffline(true);
    const off = () => setOffline(false);
    window.addEventListener("offline", on);
    window.addEventListener("online", off);
    setOffline(!navigator.onLine);
    return () => { window.removeEventListener("offline", on); window.removeEventListener("online", off); };
  }, []);

  if (!offline) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
      You're offline — changes are saved locally
    </div>
  );
}
```

### 18.4 Local Document Cache

`y-indexeddb` (already installed) handles local persistence of the Yjs document state. In addition, cache the rendered page thumbnails in Cache API for offline viewing:

```typescript
async function cacheThumbnail(pageIndex: number, thumbnailUrl: string) {
  const cache = await caches.open("page-thumbnails-v1");
  await cache.put(`/thumbnail/${documentId}/${pageIndex}`, new Response(thumbnailUrl));
}
```

### 18.5 PWA Manifest

```json
// apps/web/public/manifest.json
{
  "name": "OLPDF Editor",
  "short_name": "OLPDF",
  "description": "Edit any PDF like a Word document",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#f97316",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

---

## Phase 19 — Export Suite

**Goal:** Export to every format professionals need: EPUB3, HTML, Markdown, plain text, PNG/JPG per page, in addition to the existing PDF/PDF-A/Tagged/Fidelity exports.

### 19.1 EPUB3

```python
# apps/api/engine/epub_exporter.py
from ebooklib import epub

def export_epub(model: dict, doc_meta: dict) -> bytes:
    book = epub.EpubBook()
    book.set_identifier(doc_meta.get("id", "olpdf-doc"))
    book.set_title(doc_meta.get("title", "Untitled"))
    book.set_language("en")

    # Sort blocks in reading order (page, column, y)
    blocks = sorted(
        model.get("blocks", []),
        key=lambda b: (b.get("page_index", 0), b.get("column_index", 0), b.get("bounding_box", [0,0])[1])
    )

    # Group into chapters by page (or by heading1 blocks)
    chapters = []
    current_chapter_blocks = []
    current_chapter_title = "Chapter 1"

    for block in blocks:
        if block["type"] == "heading1" and current_chapter_blocks:
            chapters.append((current_chapter_title, current_chapter_blocks))
            current_chapter_blocks = []
            current_chapter_title = block.get("content", "Chapter")
        current_chapter_blocks.append(block)

    if current_chapter_blocks:
        chapters.append((current_chapter_title, current_chapter_blocks))

    spine = ["nav"]
    for i, (title, chap_blocks) in enumerate(chapters):
        html_content = _blocks_to_html(chap_blocks)
        chapter = epub.EpubHtml(title=title, file_name=f"chap_{i}.xhtml", lang="en")
        chapter.content = f"<html><body>{html_content}</body></html>"
        book.add_item(chapter)
        spine.append(chapter)

    book.spine = spine
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())

    import io
    buf = io.BytesIO()
    epub.write_epub(buf, book)
    return buf.getvalue()


def _blocks_to_html(blocks: list) -> str:
    html_parts = []
    for b in blocks:
        content = b.get("content", "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        btype = b.get("type", "paragraph")
        if btype == "heading1":   html_parts.append(f"<h1>{content}</h1>")
        elif btype == "heading2": html_parts.append(f"<h2>{content}</h2>")
        elif btype == "heading3": html_parts.append(f"<h3>{content}</h3>")
        elif btype == "table":
            td = b.get("table_data", {})
            rows = ([td.get("headers", [])] if td.get("headers") else []) + td.get("rows", [])
            table_html = "<table border='1'>"
            for ri, row in enumerate(rows):
                tag = "th" if ri == 0 and td.get("headers") else "td"
                table_html += "<tr>" + "".join(f"<{tag}>{c}</{tag}>" for c in row) + "</tr>"
            table_html += "</table>"
            html_parts.append(table_html)
        else:
            align = b.get("alignment", "left")
            fm = b.get("font_meta") or {}
            style = f"text-align:{align};"
            if fm.get("is_bold"): content = f"<strong>{content}</strong>"
            if fm.get("is_italic"): content = f"<em>{content}</em>"
            html_parts.append(f"<p style='{style}'>{content}</p>")
    return "\n".join(html_parts)
```

### 19.2 HTML Export

```python
def export_html(model: dict, doc_meta: dict) -> bytes:
    """Self-contained single-file HTML with inline CSS."""
    blocks = sorted(
        model.get("blocks", []),
        key=lambda b: (b.get("page_index", 0), b.get("column_index", 0), b.get("bounding_box", [0,0])[1])
    )
    body = _blocks_to_html(blocks)
    title = doc_meta.get("title", "Document")
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{title}</title>
  <style>
    body {{ font-family: Georgia, serif; max-width: 720px; margin: 40px auto; line-height: 1.6; color: #111; }}
    h1 {{ font-size: 2em; margin-top: 1.5em; }} h2 {{ font-size: 1.5em; }} h3 {{ font-size: 1.2em; }}
    table {{ border-collapse: collapse; width: 100%; }} td, th {{ border: 1px solid #ccc; padding: 6px 10px; }}
    th {{ background: #e2e8f0; font-weight: bold; }}
  </style>
</head>
<body>
  <h1>{title}</h1>
  {body}
</body>
</html>"""
    return html.encode("utf-8")
```

### 19.3 Markdown Export

```python
def export_markdown(model: dict) -> bytes:
    blocks = sorted(
        model.get("blocks", []),
        key=lambda b: (b.get("page_index", 0), b.get("column_index", 0), b.get("bounding_box", [0,0])[1])
    )
    lines = []
    for b in blocks:
        content = b.get("content", "").strip()
        if not content: continue
        btype = b.get("type", "paragraph")
        fm = b.get("font_meta") or {}
        if fm.get("is_bold") and fm.get("is_italic"): content = f"***{content}***"
        elif fm.get("is_bold"): content = f"**{content}**"
        elif fm.get("is_italic"): content = f"*{content}*"

        if btype == "heading1":    lines.append(f"# {content}\n")
        elif btype == "heading2":  lines.append(f"## {content}\n")
        elif btype == "heading3":  lines.append(f"### {content}\n")
        elif btype == "bullet_list": lines.append(f"- {content}")
        elif btype == "table":
            td = b.get("table_data", {})
            headers = td.get("headers", [])
            rows = td.get("rows", [])
            if headers:
                lines.append("| " + " | ".join(headers) + " |")
                lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
            for row in rows:
                lines.append("| " + " | ".join(row) + " |")
            lines.append("")
        else:
            lines.append(f"{content}\n")

    return "\n".join(lines).encode("utf-8")
```

### 19.4 PNG/JPG Per Page — Go Service

```go
// Add to main.go: /export/images endpoint
// Uses fpdf to render each page, then converts to image via imaging library
// OR: use the existing fidelity PDF rendering and shell out to a converter
// Recommended: render with fpdf, return a ZIP of page images

mux.HandleFunc("/export/images", func(w http.ResponseWriter, r *http.Request) {
    if !authorized(r) { writeError(w, 401, "unauthorized"); return }
    model, _, err := parseRequest(r)
    if err != nil { writeError(w, 400, err.Error()); return }

    // For each page, render to PDF then convert to PNG
    // This requires a PDF→image library (e.g., pdfium Go bindings or shell to pdftoppm)
    // For MVP: return the fidelity PDF and let client render pages to canvas for images
    writeError(w, 501, "image export not yet implemented")
})
```

For image export MVP: the Next.js frontend renders each Fabric canvas to a data URL (JPEG 0.92) and downloads as a ZIP using `JSZip`.

### 19.5 Export Dialog UI

```tsx
// apps/web/components/editor/ExportDialog.tsx
const FORMATS = [
  { id: "fidelity", label: "PDF (Fidelity)", desc: "Exact layout, coordinates preserved", icon: "📄" },
  { id: "pdfa",     label: "PDF/A",          desc: "Archival standard, ISO 19005",        icon: "🏛️" },
  { id: "tagged",   label: "Tagged PDF",     desc: "Accessible, screen reader friendly",  icon: "♿" },
  { id: "epub",     label: "EPUB3",           desc: "For e-readers and book apps",         icon: "📚" },
  { id: "html",     label: "HTML",            desc: "Self-contained single-file webpage",  icon: "🌐" },
  { id: "markdown", label: "Markdown",        desc: "Developer-friendly plain text",       icon: "📝" },
  { id: "images",   label: "Images (ZIP)",    desc: "One PNG per page",                   icon: "🖼️" },
];
```

---

## Phase 20 — Polish & Production Hardening

**Goal:** Every rough edge removed. The editor feels as polished as Notion or Figma.

### 20.1 Keyboard Shortcut Map

```tsx
// Press ? anywhere (not in text input) to open shortcut overlay
// apps/web/components/editor/ShortcutMap.tsx

const SHORTCUTS = [
  { keys: ["⌘", "Z"], action: "Undo" },
  { keys: ["⌘", "⇧", "Z"], action: "Redo" },
  { keys: ["⌘", "S"], action: "Save" },
  { keys: ["⌘", "F"], action: "Find" },
  { keys: ["⌘", "H"], action: "Find & Replace" },
  { keys: ["⌘", "B"], action: "Bold" },
  { keys: ["⌘", "I"], action: "Italic" },
  { keys: ["⌘", "K"], action: "Insert Link" },
  { keys: ["Delete"], action: "Delete selected block" },
  { keys: ["Escape"], action: "Deselect / Close" },
  { keys: ["?"], action: "Show shortcuts" },
  { keys: ["⌘", "↑"], action: "Scroll to top" },
  { keys: ["⌘", "↓"], action: "Scroll to bottom" },
];

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const inInput = ["INPUT","TEXTAREA"].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable;
    if (!inInput && e.key === "?") setShowShortcuts(v => !v);
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

### 20.2 Accessibility (ARIA)

Every Fabric canvas block must have a corresponding ARIA-described element for screen readers. Since Fabric is a `<canvas>` element (inaccessible by default), maintain a hidden accessible DOM tree in parallel:

```tsx
// Hidden accessible tree (visually hidden, screen reader visible)
<div className="sr-only" aria-label={`Page ${pageIndex + 1} content`}>
  {pageBlocks.map(block => (
    <div
      key={block.id}
      role={block.type.startsWith("heading") ? "heading" : "paragraph"}
      aria-level={block.type === "heading1" ? 1 : block.type === "heading2" ? 2 : block.type === "heading3" ? 3 : undefined}
      tabIndex={0}
      onFocus={() => scrollToBlock(block.id)}
    >
      {block.content}
    </div>
  ))}
</div>
```

Tab focus cycles through the accessible tree. Pressing Enter on a focused element activates it in the Fabric canvas.

### 20.3 Mobile & Touch

```typescript
// In FidelityCanvas.tsx — add touch event handlers:

fcanvas.on("touch:gesture", (e) => {
  // Pinch to zoom: adjust scale state
  if (e.self.touches === 2) {
    const newScale = Math.max(0.3, Math.min(3, scale * e.self.scale));
    setScale(newScale);
  }
});

// Long-press shows context menu
let longPressTimer: ReturnType<typeof setTimeout>;
fcanvas.on("mouse:down", () => {
  longPressTimer = setTimeout(() => setContextMenuOpen(true), 500);
});
fcanvas.on("mouse:up", () => clearTimeout(longPressTimer));
```

Add mobile-friendly toolbar:
- Larger touch targets (44×44px minimum per WCAG)
- Bottom sheet toolbar on mobile (instead of top bar)
- Swipe left/right between pages

### 20.4 Error Boundaries

```tsx
// apps/web/components/editor/PageErrorBoundary.tsx
"use client";
import { Component, type ReactNode } from "react";

export class PageErrorBoundary extends Component<
  { children: ReactNode; pageIndex: number },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[FidelityCanvas] Page ${this.props.pageIndex} crashed:`, error);
    // Report to Sentry
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-red-500 bg-red-50 rounded">
          Page {this.props.pageIndex + 1} failed to render.
          <button onClick={() => this.setState({ hasError: false })} className="ml-2 underline">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap every `VirtualizedPage` in a `PageErrorBoundary`. One broken page never crashes the entire editor.

### 20.5 Telemetry (PostHog)

```typescript
// apps/web/lib/analytics.ts
import posthog from "posthog-js";

export function trackEdit(action: string, properties?: Record<string, unknown>) {
  posthog.capture(`editor_${action}`, {
    $set_once: { first_edit: new Date().toISOString() },
    ...properties,
  });
}

// Usage throughout the editor:
trackEdit("format_applied", { format: "bold", blockType: selectedBlock.blockType });
trackEdit("export_triggered", { format: "pdfa" });
trackEdit("ai_rewrite_accepted", { instruction: "improve" });
trackEdit("find_replace_used", { replaced_count: matches.length });
```

Events are anonymous — no PII. Used only for product decisions.

### 20.6 Lighthouse CI Budget

Add to CI pipeline:

```yaml
# .github/workflows/ci.yml
- name: Lighthouse CI
  uses: treosh/lighthouse-ci-action@v12
  with:
    urls: |
      https://staging.olpdf.xyz/editor/test-doc
    budgetPath: .lighthouserc.json
    uploadArtifacts: true

# .lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.85 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interactive": ["error", { "maxNumericValue": 4000 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

### 20.7 Dark Mode

```typescript
// All Fabric canvas backgrounds respond to CSS color scheme:

useEffect(() => {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  for (const canvas of fabricCanvasesRef.current.values()) {
    canvas.setBackgroundColor(isDark ? "#1e1e1e" : "#ffffff", () => canvas.renderAll());
  }

  const listener = (e: MediaQueryListEvent) => {
    for (const canvas of fabricCanvasesRef.current.values()) {
      canvas.setBackgroundColor(e.matches ? "#1e1e1e" : "#ffffff", () => canvas.renderAll());
    }
  };
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", listener);
  return () => window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", listener);
}, []);
```

---

## Integration Contract Summary

| Phase | Reads From | Writes To | Key Files |
|---|---|---|---|
| 8 — Reflow | `model.blocks`, Fabric canvas | New `DocumentModel` | `apps/web/engine/reflow.ts` |
| 9 — TipTap | `model.blocks`, Fabric events | `block.content`, `block.rich_content` | `apps/web/components/editor/TipTapOverlay.tsx` |
| 10 — Virtualization | `model.page_dimensions` | Fabric canvas lifecycle | `apps/web/components/editor/VirtualizedPage.tsx` |
| 11 — Find & Replace | `model.blocks` | `model.blocks` (replace) | `apps/web/engine/search.ts`, `FindReplaceBar.tsx` |
| 12 — Comments | Supabase `document_comments` | Supabase | `apps/api/routes/comments.py`, `CommentSidebar.tsx` |
| 13 — Collaboration | Yjs `ydoc`, Fabric canvas | Yjs `ydoc`, Fabric canvas | `apps/web/hooks/useCollaboration.ts` |
| 14 — Track Changes | `model.blocks`, Yjs | `ChangeRecord[]`, `document_versions` | `apps/web/engine/trackChanges.ts` |
| 15 — Styles | `documents.doc_styles` | `block.applied_style_id` | `apps/web/engine/styles.ts` |
| 16 — AI | `model.blocks`, original PDF | `block.content` (via tracked change) | `apps/api/routes/ai.py` |
| 17 — Forms | `model.blocks` | `form_submissions` | `apps/api/routes/forms.py`, `fill/page.tsx` |
| 18 — Offline | Yjs IndexedDB, Cache API | IndexedDB, Supabase (on sync) | `public/sw.js` |
| 19 — Export Suite | `model.blocks`, `doc_meta` | File download | `apps/api/engine/epub_exporter.py`, Go service |
| 20 — Polish | All of above | — | Cross-cutting |

---

## Dependency Checklist

**Already installed:**
- `fabric` ^6, `yjs`, `y-indexeddb`, `y-supabase`, `@tiptap/*` (full suite), `zustand`, `@tanstack/react-query`, `lodash`

**To install (per phase):**
- Phase 8: none
- Phase 9: none (TipTap already installed)
- Phase 10: none
- Phase 11: `diff` (npm)
- Phase 12: none
- Phase 13: none (y-supabase already installed)
- Phase 14: `diff` (npm)
- Phase 15: none
- Phase 16: `anthropic` (Python, already in API)
- Phase 17: none
- Phase 18: `next-pwa` or `workbox-*`; `ebooklib` (Python)
- Phase 19: `ebooklib` (Python), `jszip` (npm)
- Phase 20: `posthog-js` (npm)

**Python:**
- `ebooklib` — for EPUB3 export
- `diff` — not needed (Python `difflib` is stdlib)

---

*Build in order. Each phase builds on the previous. Do not skip.*
