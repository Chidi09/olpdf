"use client";

import { useEffect, useRef } from "react";
import type { DocumentBlock } from "@olpdf/document-model";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";

interface TipTapOverlayProps {
  block: DocumentBlock;
  scale: number;
  canvasLeft: number;
  canvasTop: number;
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
  const fm = block.font_meta ?? {};

  const committedRef = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color],
    content: (block.rich_content as Record<string, unknown> | undefined) ?? block.content ?? "",
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
      onCommit(activeEditor.getText(), activeEditor.getJSON() as Record<string, unknown>);
    },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!editor) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (committedRef.current) return;
        committedRef.current = true;
        onCommit(editor.getText(), editor.getJSON() as Record<string, unknown>);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        committedRef.current = true; // prevent onBlur from committing on unmount
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
