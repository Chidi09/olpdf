"use client";

/**
 * DocumentFlowEditor — document-wide TipTap editing overlay.
 *
 * Replaces the single-block TipTapOverlay.  Every text block on the current
 * page is rendered as an absolutely-positioned contenteditable region at its
 * exact bounding-box coordinates.  A custom TipTap extension wires up
 * ArrowLeft / ArrowRight / Backspace at block boundaries so the cursor flows
 * naturally from block to block — exactly like a Word processor.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ASTSpan, DocumentBlock } from "@olpdf/document-model";
import { EditorContent, Extension, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useFidelityCanvasStore } from "@/store/useFidelityCanvasStore";

// ─── ASTSpan ↔ TipTap JSON conversion (mirrors TipTapOverlay helpers) ─────────

type TipTapMark = { type: string; attrs?: Record<string, unknown> };
type TipTapNode = {
  type: string;
  text?: string;
  marks?: TipTapMark[];
  content?: TipTapNode[];
};

function richSpansToDoc(spans: ASTSpan[]): TipTapNode {
  const inlineNodes: TipTapNode[] = spans
    .filter((s) => s.text)
    .map((span) => {
      const marks: TipTapMark[] = [];
      if (span.bold) marks.push({ type: "bold" });
      if (span.italic) marks.push({ type: "italic" });
      if (span.underline) marks.push({ type: "underline" });
      if (span.strikethrough) marks.push({ type: "strike" });
      if (span.color) marks.push({ type: "textStyle", attrs: { color: span.color } });
      if (span.link_href) marks.push({ type: "link", attrs: { href: span.link_href } });
      const node: TipTapNode = { type: "text", text: span.text };
      if (marks.length > 0) node.marks = marks;
      return node;
    });
  return { type: "doc", content: [{ type: "paragraph", content: inlineNodes }] };
}

function docToRichSpans(doc: Record<string, unknown>): ASTSpan[] {
  const spans: ASTSpan[] = [];
  function traverse(node: TipTapNode): void {
    if (node.type === "text") {
      const marks = node.marks ?? [];
      const colorMark = marks.find((m) => m.type === "textStyle");
      const linkMark = marks.find((m) => m.type === "link");
      spans.push({
        text: node.text ?? "",
        bold: marks.some((m) => m.type === "bold"),
        italic: marks.some((m) => m.type === "italic"),
        underline: marks.some((m) => m.type === "underline"),
        strikethrough: marks.some((m) => m.type === "strike"),
        color: (colorMark?.attrs?.color as string) ?? undefined,
        link_href: (linkMark?.attrs?.href as string) ?? undefined,
        mark: false,
      });
    } else if (Array.isArray(node.content)) {
      for (const child of node.content) traverse(child);
      if (node.type === "paragraph" && spans.length > 0) {
        const last = spans[spans.length - 1];
        if (last && !last.text.endsWith(" ")) last.text += " ";
      }
    }
  }
  traverse(doc as unknown as TipTapNode);
  return spans.filter((s) => s.text.length > 0);
}

// ─── Cross-block navigation TipTap extension ──────────────────────────────────

interface CrossBlockOptions {
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onMergeWithPrev: (text: string, spans: ASTSpan[]) => void;
}

const CrossBlockNav = Extension.create<CrossBlockOptions>({
  name: "crossBlockNav",
  addOptions(): CrossBlockOptions {
    return {
      onNavigateNext: () => undefined,
      onNavigatePrev: () => undefined,
      onMergeWithPrev: () => undefined,
    };
  },
  addKeyboardShortcuts() {
    return {
      ArrowRight: ({ editor }) => {
        const { state } = editor;
        const { from, to, empty } = state.selection;
        if (!empty) return false;
        if (from < state.doc.content.size - 1) return false;
        this.options.onNavigateNext();
        return true;
      },
      ArrowDown: ({ editor }) => {
        // Navigate next only when the cursor is already on the last text node
        const { state } = editor;
        const { from, empty } = state.selection;
        if (!empty) return false;
        const docEnd = state.doc.content.size;
        if (from < docEnd - 2) return false; // more content below
        this.options.onNavigateNext();
        return true;
      },
      ArrowLeft: ({ editor }) => {
        const { state } = editor;
        const { from, empty } = state.selection;
        if (!empty) return false;
        if (from > 1) return false;
        this.options.onNavigatePrev();
        return true;
      },
      ArrowUp: ({ editor }) => {
        const { state } = editor;
        const { from, empty } = state.selection;
        if (!empty) return false;
        if (from > 1) return false;
        this.options.onNavigatePrev();
        return true;
      },
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { from, empty } = state.selection;
        if (!empty || from > 1) return false;
        const json = editor.getJSON() as Record<string, unknown>;
        const spans = docToRichSpans(json);
        this.options.onMergeWithPrev(editor.getText(), spans);
        return true;
      },
    };
  },
});

// ─── Single block editor cell ──────────────────────────────────────────────────

interface BlockCellProps {
  block: DocumentBlock;
  scale: number;
  isFocused: boolean;
  cursorTarget: "start" | "end" | null;
  onFocus: () => void;
  onChange: (text: string, spans: ASTSpan[]) => void;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onMergeWithPrev: (text: string, spans: ASTSpan[]) => void;
}

function BlockCell({
  block,
  scale,
  isFocused,
  cursorTarget,
  onFocus,
  onChange,
  onNavigateNext,
  onNavigatePrev,
  onMergeWithPrev,
}: BlockCellProps) {
  const bbox = block.bounding_box ?? [0, 0, 0, 0];
  const [x0, y0, x1, y1] = bbox;
  const fm = block.font_meta ?? ({} as NonNullable<DocumentBlock["font_meta"]>);

  const initialContent: string | Record<string, unknown> =
    block.rich_spans?.length
      ? richSpansToDoc(block.rich_spans)
      : (block.rich_content as Record<string, unknown> | undefined) ?? block.content ?? "";

  // Keep stable references to callbacks so the extension sees the latest values
  const cbRef = useRef({ onNavigateNext, onNavigatePrev, onMergeWithPrev, onChange });
  useEffect(() => {
    cbRef.current = { onNavigateNext, onNavigatePrev, onMergeWithPrev, onChange };
  });

  // Stable ref for isFocused — readable inside editor callbacks without stale closure
  const focusedRef = useRef(isFocused);
  useEffect(() => { focusedRef.current = isFocused; });

  // Store access for FormatBar integration
  const { pendingFormat, clearPendingFormat } = useFidelityCanvasStore();

  const pushSelectionToStore = (e: Editor) => {
    if (!focusedRef.current) return;
    useFidelityCanvasStore.getState().setSelectedBlock({
      blockId: block.id,
      blockType: block.type,
      fontFamily: String(fm.family ?? "Georgia"),
      fontSize: Number(fm.size ?? 11),
      isBold: e.isActive("bold"),
      isItalic: e.isActive("italic"),
      color: (e.getAttributes("textStyle").color as string | undefined) ?? String(fm.color ?? "#000000"),
      alignment: block.alignment ?? "left",
      left: x0,
      top: y0,
      width: x1 - x0,
      height: y1 - y0,
    });
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      CrossBlockNav.configure({
        onNavigateNext: () => cbRef.current.onNavigateNext(),
        onNavigatePrev: () => cbRef.current.onNavigatePrev(),
        onMergeWithPrev: (text, spans) => cbRef.current.onMergeWithPrev(text, spans),
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        spellcheck: "true",
        style: [
          `font-family: ${String(fm.family ?? "Georgia")}, serif`,
          `font-size: ${Number(fm.size ?? 11) * scale}px`,
          `font-weight: ${fm.is_bold ? "bold" : "normal"}`,
          `font-style: ${fm.is_italic ? "italic" : "normal"}`,
          `color: ${String(fm.color ?? "#111111")}`,
          `text-align: ${block.alignment ?? "left"}`,
          "line-height: 1.25",
          "outline: none",
          "white-space: pre-wrap",
          "word-break: break-word",
          "min-height: 1em",
        ].join(";"),
      },
    },
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON() as Record<string, unknown>;
      cbRef.current.onChange(e.getText(), docToRichSpans(json));
    },
    onSelectionUpdate: ({ editor: e }) => {
      pushSelectionToStore(e);
    },
  });

  // Push block selection to store when this cell gains focus
  useEffect(() => {
    if (!isFocused || !editor) return;
    pushSelectionToStore(editor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, editor]);

  // Clear store when this focused cell unmounts
  useEffect(() => {
    return () => {
      if (focusedRef.current) {
        useFidelityCanvasStore.getState().setSelectedBlock(null);
      }
    };
  }, []);

  // Apply FormatBar commands to the focused editor
  useEffect(() => {
    if (!pendingFormat || !isFocused || !editor) return;
    if (pendingFormat.isBold !== undefined) {
      if (pendingFormat.isBold) editor.chain().focus().setBold().run();
      else editor.chain().focus().unsetBold().run();
    }
    if (pendingFormat.isItalic !== undefined) {
      if (pendingFormat.isItalic) editor.chain().focus().setItalic().run();
      else editor.chain().focus().unsetItalic().run();
    }
    if (pendingFormat.color !== undefined) {
      editor.chain().focus().setColor(pendingFormat.color).run();
    }
    clearPendingFormat();
  }, [pendingFormat, isFocused, editor, clearPendingFormat]);

  // Focus management: move cursor to start/end when this cell gains focus
  useEffect(() => {
    if (!isFocused || !editor || !cursorTarget) return;
    // Defer one tick so TipTap has finished mounting
    const t = setTimeout(() => {
      if (cursorTarget === "end") editor.commands.focus("end");
      else editor.commands.focus("start");
    }, 0);
    return () => clearTimeout(t);
  }, [isFocused, editor, cursorTarget]);

  return (
    <div
      role="textbox"
      aria-label={`Edit block ${block.id}`}
      style={{
        position: "absolute",
        left: x0 * scale,
        top: y0 * scale,
        width: (x1 - x0) * scale,
        minHeight: (y1 - y0) * scale,
        background: isFocused ? "white" : "transparent",
        border: isFocused ? "2px solid #f97316" : "1px solid transparent",
        borderRadius: 2,
        padding: 2,
        boxSizing: "border-box",
        cursor: "text",
        zIndex: isFocused ? 60 : 51,
        transition: "background 0.1s, border-color 0.1s",
      }}
      onMouseDown={(e) => {
        if (!isFocused) {
          e.preventDefault();
          onFocus();
        }
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

// ─── DocumentFlowEditor ────────────────────────────────────────────────────────

export interface DocumentFlowEditorProps {
  /** Text blocks for the current page only */
  blocks: DocumentBlock[];
  /** All model blocks — used to find adjacent pages for cross-page navigation */
  allBlocks: DocumentBlock[];
  scale: number;
  initialBlockId: string;
  cursorTarget?: "start" | "end";
  onCommit: (updatedBlocks: DocumentBlock[], deletedIds: string[]) => void;
  /** Called when the cursor navigates past the first/last block — lets the
   *  parent switch the active page editor. */
  onNavigateToPage: (
    pageIndex: number,
    blockId: string,
    cursorTarget: "start" | "end",
  ) => void;
  onClose: () => void;
}

export function DocumentFlowEditor({
  blocks,
  allBlocks,
  scale,
  initialBlockId,
  cursorTarget: initialCursor = "end",
  onCommit,
  onNavigateToPage,
  onClose,
}: DocumentFlowEditorProps) {
  // Reading order: column ASC, then y ASC
  const ordered = useMemo(
    () =>
      blocks
        .filter((b) => !["shape", "table", "field", "image"].includes(b.type))
        .sort((a, b) => {
          const ci = (a.column_index ?? 0) - (b.column_index ?? 0);
          if (ci !== 0) return ci;
          return (a.bounding_box?.[1] ?? 0) - (b.bounding_box?.[1] ?? 0);
        }),
    [blocks],
  );

  const pageIndex = ordered[0]?.page_index ?? 0;

  const [focusedIdx, setFocusedIdx] = useState<number>(() =>
    Math.max(0, ordered.findIndex((b) => b.id === initialBlockId)),
  );
  const [cursorTarget, setCursorTarget] = useState<"start" | "end">(initialCursor);

  // Track all pending edits: blockId → { text, spans }
  const editsRef = useRef(new Map<string, { text: string; spans: ASTSpan[] }>());
  // Track blocks deleted via Backspace-merge
  const deletedRef = useRef(new Set<string>());

  const commitAndClose = useCallback(() => {
    const updatedBlocks = blocks.map((b) => {
      const edit = editsRef.current.get(b.id);
      if (!edit) return b;
      return { ...b, content: edit.text, rich_spans: edit.spans };
    });
    onCommit(updatedBlocks, Array.from(deletedRef.current));
    onClose();
  }, [blocks, onCommit, onClose]);

  // Keyboard: Escape commits and closes; Ctrl/Cmd+Enter also commits
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); commitAndClose(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); commitAndClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commitAndClose]);

  // Navigate to next block (or next page if past the last block)
  const navigateNext = useCallback(() => {
    if (focusedIdx < ordered.length - 1) {
      setFocusedIdx(focusedIdx + 1);
      setCursorTarget("start");
    } else {
      // Try to find the first block on the next page
      const nextPageIdx = pageIndex + 1;
      const nextPageBlocks = allBlocks
        .filter((b) => (b.page_index ?? 0) === nextPageIdx && !["shape","table","field","image"].includes(b.type))
        .sort((a, b) => (a.column_index ?? 0) - (b.column_index ?? 0) || (a.bounding_box?.[1] ?? 0) - (b.bounding_box?.[1] ?? 0));
      if (nextPageBlocks.length > 0) {
        commitAndClose();
        onNavigateToPage(nextPageIdx, nextPageBlocks[0].id, "start");
      }
    }
  }, [focusedIdx, ordered.length, pageIndex, allBlocks, commitAndClose, onNavigateToPage]);

  // Navigate to previous block (or previous page)
  const navigatePrev = useCallback(() => {
    if (focusedIdx > 0) {
      setFocusedIdx(focusedIdx - 1);
      setCursorTarget("end");
    } else {
      const prevPageIdx = pageIndex - 1;
      if (prevPageIdx < 0) return;
      const prevPageBlocks = allBlocks
        .filter((b) => (b.page_index ?? 0) === prevPageIdx && !["shape","table","field","image"].includes(b.type))
        .sort((a, b) => (b.column_index ?? 0) - (a.column_index ?? 0) || (b.bounding_box?.[1] ?? 0) - (a.bounding_box?.[1] ?? 0));
      if (prevPageBlocks.length > 0) {
        commitAndClose();
        onNavigateToPage(prevPageIdx, prevPageBlocks[0].id, "end");
      }
    }
  }, [focusedIdx, pageIndex, allBlocks, commitAndClose, onNavigateToPage]);

  // Backspace at start: merge current block content into previous block
  const handleMerge = useCallback(
    (currentText: string, currentSpans: ASTSpan[]) => {
      if (focusedIdx === 0) return;
      const currentBlock = ordered[focusedIdx];
      const prevBlock = ordered[focusedIdx - 1];
      if (!currentBlock || !prevBlock) return;

      const prevEdit = editsRef.current.get(prevBlock.id);
      const prevSpans: ASTSpan[] = prevEdit?.spans ?? prevBlock.rich_spans ?? [];
      const prevText = prevEdit?.text ?? prevBlock.content ?? "";

      // Merge: append current text to prev
      const mergedText = (prevText.trimEnd() + " " + currentText.trimStart()).trim();
      const mergedSpans: ASTSpan[] = [
        ...prevSpans,
        ...(currentSpans.length > 0
          ? currentSpans
          : [{ text: currentText, bold: false, italic: false, underline: false, strikethrough: false, mark: false }]),
      ];

      editsRef.current.set(prevBlock.id, { text: mergedText, spans: mergedSpans });
      deletedRef.current.add(currentBlock.id);

      setFocusedIdx(focusedIdx - 1);
      setCursorTarget("end");
    },
    [focusedIdx, ordered],
  );

  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 50, pointerEvents: "none" }}
      // Click directly on the overlay backdrop (not on any block) → commit & close
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) { commitAndClose(); }
      }}
    >
      {ordered.map((block, idx) => (
        <BlockCell
          key={block.id}
          block={block}
          scale={scale}
          isFocused={idx === focusedIdx}
          cursorTarget={idx === focusedIdx ? cursorTarget : null}
          onFocus={() => { setFocusedIdx(idx); setCursorTarget("end"); }}
          onChange={(text, spans) => { editsRef.current.set(block.id, { text, spans }); }}
          onNavigateNext={navigateNext}
          onNavigatePrev={navigatePrev}
          onMergeWithPrev={handleMerge}
        />
      ))}
    </div>
  );
}
