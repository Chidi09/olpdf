"use client";

import { useState } from "react";

type AiLog = {
  log_id: string;
  instruction: string;
  tool_calls: { name: string; args: Record<string, unknown> }[];
  diff_snapshot: { before: unknown[]; after: unknown[] };
  status: string;
  created_at?: string;
};

export function useTheme(documentId: string) {
  const [applying, setApplying] = useState(false);
  const [activeLog, setActiveLog] = useState<AiLog | null>(null);

  const applyPreset = async (presetId: string): Promise<AiLog | null> => {
    setApplying(true);
    try {
      const res = await fetch(
        `/api/bff/ai/documents/${documentId}/theme/preset`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preset_id: presetId }),
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as AiLog;
      setActiveLog(data);
      return data;
    } finally {
      setApplying(false);
    }
  };

  const generateTheme = async (description: string): Promise<AiLog | null> => {
    setApplying(true);
    try {
      const res = await fetch(
        `/api/bff/ai/documents/${documentId}/theme`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ css: description, theme_name: "ai-custom" }),
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as AiLog;
      setActiveLog(data);
      return data;
    } finally {
      setApplying(false);
    }
  };

  const applyCustomCss = async (css: string): Promise<AiLog | null> => {
    setApplying(true);
    try {
      const res = await fetch(
        `/api/bff/ai/documents/${documentId}/theme`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ css, theme_name: "custom" }),
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as AiLog;
      setActiveLog(data);
      return data;
    } finally {
      setApplying(false);
    }
  };

  const clearActiveLog = () => setActiveLog(null);

  return {
    applying,
    activeLog,
    applyPreset,
    generateTheme,
    applyCustomCss,
    clearActiveLog,
  };
}
