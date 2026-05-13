"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import React from "react";

/**
 * ShapeNode — Custom TipTap node for rendering SVG shapes.
 */
export const ShapeExtension = Node.create({
  name: "shapeBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      shapeType: { default: "rect" }, // rect | ellipse | line
      fill: { default: "rgba(14,165,233,0.12)" },
      stroke: { default: "#0284c7" },
      strokeWidth: { default: 2 },
      width: { default: 100 },
      height: { default: 100 },
      float: { default: "none" },
      blockId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="shape-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "shape-block" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ShapeBlockView);
  },
});

function ShapeBlockView(props: any) {
  const { node, selected } = props;
  const { shapeType, fill, stroke, strokeWidth, width, height, float } = node.attrs;

  const w = Number(width);
  const h = Number(height);

  const style: React.CSSProperties = {
    float: float === "none" ? "none" : (float as any),
    width: `${w}px`,
    height: `${h}px`,
    margin: float === "none" ? "0 auto" : (float === "left" ? "0 1rem 0.5rem 0" : "0 0 0.5rem 1rem"),
    shapeOutside: float !== "none" ? "inset(0)" : "none",
  };

  return (
    <div
      className={`relative ${selected ? "ring-2 ring-[var(--accent)]" : ""}`}
      style={style}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block overflow-visible">
        {shapeType === "rect" && (
          <rect x={strokeWidth} y={strokeWidth} width={w - strokeWidth*2} height={h - strokeWidth*2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        )}
        {shapeType === "ellipse" && (
          <ellipse cx={w/2} cy={h/2} rx={w/2 - strokeWidth} ry={h/2 - strokeWidth} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        )}
      </svg>
    </div>
  );
}
