"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import React from "react";

/**
 * ImageNode — Custom TipTap node for rendering images with R2 sources and resize logic.
 */
export const ImageExtension = Node.create({
  name: "imageBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      width: { default: "100%" },
      height: { default: "auto" },
      alt: { default: "" },
      float: { default: "none" }, // none | left | right
      blockId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-type="image-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { "data-type": "image-block" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },
});

function ImageBlockView(props: any) {
  const { node, selected } = props;
  const { src, width, height, float } = node.attrs;

  const style: React.CSSProperties = {
    float: float === "none" ? "none" : (float as any),
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    margin: float === "none" ? "0 auto" : (float === "left" ? "0 1rem 0.5rem 0" : "0 0 0.5rem 1rem"),
    shapeOutside: float !== "none" ? "inset(0)" : "none",
    display: float === "none" ? "block" : "block",
  };

  return (
    <div
      className={`relative transition-all ${selected ? "ring-2 ring-[var(--accent)]" : ""}`}
      style={style}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="block w-full h-full object-contain pointer-events-none"
        />
      ) : (
        <div className="w-full h-32 bg-[var(--bg-surface)] animate-pulse flex items-center justify-center border-2 border-dashed border-white/10 rounded">
           <span className="text-[10px] text-[var(--text-secondary)]">Uploading...</span>
        </div>
      )}

      {selected && (
        <div className="absolute inset-0 border-2 border-[var(--accent)] pointer-events-none" />
      )}
    </div>
  );
}
