import type { ImageFrame } from "@/types/pageLayout";

export type DocumentImageAsset = {
  assetKey: string;
  contentType: string;
  url: string;
};

export async function uploadDocumentImageAsset(docId: string, file: File): Promise<DocumentImageAsset> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/bff/documents/${docId}/assets`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

export function createImageFrame(
  x: number,
  y: number,
  width: number,
  height: number,
  src: string,
  assetKey: string,
): ImageFrame {
  return {
    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "image",
    src,
    objectKey: assetKey,
    visible: true,
    locked: false,
    zIndex: 0,
    opacity: 1,
    x,
    y,
    width,
    height,
    rotation: 0,
  };
}
