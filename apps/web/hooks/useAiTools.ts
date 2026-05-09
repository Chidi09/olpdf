"use client";

import { useState } from "react";
import type { DocumentBlock } from "@olpdf/document-model";

type ChangeRecord = {
  id: string;
  blockId: string;
  field: "content" | "bounding_box" | "font_meta" | "alignment";
  oldValue: unknown;
  newValue: unknown;
  userId: string;
  userName: string;
  timestamp: number;
  status: "pending" | "accepted" | "rejected";
};

export function useAiTools(
  documentId: string,
  getBlocks: () => DocumentBlock[],
  addPendingChange: (change: ChangeRecord) => void,
) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const aiRewrite = async (blockId: string, instruction: string) => {
    const res = await fetch(`/api/bff/ai/documents/${documentId}/blocks/${blockId}/rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { suggestion?: string; original?: string };
    addPendingChange({
      id: crypto.randomUUID(),
      blockId,
      field: "content",
      oldValue: data.original ?? "",
      newValue: data.suggestion ?? "",
      userId: "ai",
      userName: "AI",
      timestamp: Date.now(),
      status: "pending",
    });
  };

  const triggerOcrVerify = async (blockId: string) => {
    const res = await fetch(`/api/bff/ai/documents/${documentId}/blocks/${blockId}/ocr-verify`, { method: "POST" });
    if (!res.ok) return;
    const data = (await res.json()) as { verified?: boolean; correction?: string | null };
    if (data.verified || !data.correction) return;
    const current = getBlocks().find((b) => b.id === blockId);
    addPendingChange({
      id: crypto.randomUUID(),
      blockId,
      field: "content",
      oldValue: current?.content ?? "",
      newValue: data.correction,
      userId: "ai",
      userName: "AI OCR",
      timestamp: Date.now(),
      status: "pending",
    });
  };

  const summariseDoc = async () => {
    const res = await fetch(`/api/bff/ai/documents/${documentId}/summarise`, { method: "POST" });
    if (!res.ok) return;
    const data = (await res.json()) as { summary?: string };
    setAiSummary(data.summary ?? null);
  };

  return { aiSummary, aiRewrite, triggerOcrVerify, summariseDoc };
}
