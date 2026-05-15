import type { AnnotationFrame, CommentFrame, SignatureFrame, HighlightFrame } from "@/types/pageLayout";

export function createHighlightFrame(
  x: number, y: number, width: number, height: number,
  color = "#ffeb3b",
): HighlightFrame {
  return {
    id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "annotation",
    annotationType: "highlight",
    color,
    visible: true,
    locked: false,
    zIndex: 0,
    opacity: 0.4,
    x,
    y,
    width,
    height,
    rotation: 0,
  };
}

export function createCommentFrame(
  x: number, y: number, text: string, author: string,
): CommentFrame {
  return {
    id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "annotation",
    annotationType: "comment",
    text,
    author,
    resolved: false,
    visible: true,
    locked: false,
    zIndex: 0,
    opacity: 1,
    x,
    y,
    width: 24,
    height: 24,
    rotation: 0,
  };
}

export function createSignatureFrame(
  x: number, y: number, signerName: string, imageSrc?: string,
): SignatureFrame {
  return {
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "annotation",
    annotationType: "signature",
    signerName,
    imageSrc,
    drawn: false,
    typed: true,
    visible: true,
    locked: false,
    zIndex: 0,
    opacity: 1,
    x,
    y,
    width: 200,
    height: 80,
    rotation: 0,
  };
}
