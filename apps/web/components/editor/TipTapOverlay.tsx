"use client";

import { useEffect, useRef } from "react";
import type { ASTSpan, DocumentBlock } from "@olpdf/document-model";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";

// ─── ASTSpan ↔ TipTap JSON conversion ────────────────────────────────────────

type TipTapMark = { type: string; attrs?: Record<string, unknown> };
type TipTapNode = { type: string; text?: string; marks?: TipTapMark[]; content?: TipTapNode[] };

function richSpansToTipTapDoc(spans: ASTSpan[]): TipTapNode {
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

  return {
    type: "doc",
    content: [{ type: "paragraph", content: inlineNodes }],
  };
}

function tipTapDocToRichSpans(doc: Record<string, unknown>): ASTSpan[] {
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
      // Paragraph boundary → add a space to separate runs
      if (node.type === "paragraph" && spans.length > 0) {
        const last = spans[spans.length - 1];
        if (last && !last.text.endsWith(" ")) last.text += " ";
      }
    }
  }

  traverse(doc as unknown as TipTapNode);
  return spans.filter((s) => s.text.length > 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TipTapOverlayProps {
  block: DocumentBlock;
  scale: number;
  canvasLeft: number;
  canvasTop: number;
  /** richContent will include _rich_spans: ASTSpan[] for consumers that want it */
  onCommit: (content: string, richContent: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function TipTapOverlay({
  block,
  scale,
  canvasLeft,
  canvasTop,
  onCommit,
  onCancel,
}: TipTapOverlayProps) {
  const bbox = block.bounding_box ?? [0, 0, 0, 0];
  const [x0, y0, x1, y1] = bbox;
  const fm = block.font_meta ?? {} as NonNullable<DocumentBlock["font_meta"]>;

  const committedRef = useRef(false);

  // Seed from rich_spans → TipTap doc → rich_content → plain text (priority order)
  const initialContent: string | Record<string, unknown> =
    block.rich_spans?.length
      ? richSpansToTipTapDoc(block.rich_spans)
      : (block.rich_content as Record<string, unknown> | undefined) ?? block.content ?? "";

  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color],
    content: initialContent,
    autofocus: "end",
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
        ].join(";"),
      },
    },
    onBlur: ({ editor: activeEditor }) => {
      if (committedRef.current) return;
      committedRef.current = true;
      const json = activeEditor.getJSON() as Record<string, unknown>;
      const richSpans = tipTapDocToRichSpans(json);
      onCommit(activeEditor.getText(), { ...json, _rich_spans: richSpans });
    },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!editor) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (committedRef.current) return;
        committedRef.current = true;
        const json = editor.getJSON() as Record<string, unknown>;
        const richSpans = tipTapDocToRichSpans(json);
        onCommit(editor.getText(), { ...json, _rich_spans: richSpans });
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        committedRef.current = true;
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, onCancel, onCommit]);

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
