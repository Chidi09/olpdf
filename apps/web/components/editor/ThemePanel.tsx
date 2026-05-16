"use client";

import { useState } from "react";
import type { DocumentModel } from "@olpdf/document-model";

type ThemePanelProps = {
  documentId: string;
  currentModel: DocumentModel | null;
  onThemeApplied: (logId: string) => void;
};

const PRESETS = [
  {
    id: "corporate",
    name: "Corporate",
    colors: ["#1B2A4A", "#F0F4F8", "#333333"],
    description: "Navy headings, Georgia serif",
  },
  {
    id: "academic",
    name: "Academic",
    colors: ["#000000", "#F9F9F9", "#333333"],
    description: "Times New Roman, APA style",
  },
  {
    id: "resume",
    name: "Resume",
    colors: ["#1a1a1a", "#ffffff", "#222222"],
    description: "Tight, ATS-friendly",
  },
  {
    id: "minimal",
    name: "Minimal",
    colors: ["#111111", "#F5F5F5", "#444444"],
    description: "System-ui, clean space",
  },
  {
    id: "bold",
    name: "Bold",
    colors: ["#16213E", "#FFF4E0", "#E94560"],
    description: "36pt headings, accent pops",
  },
] as const;

type Tab = "presets" | "generate" | "custom";

export default function ThemePanel({
  documentId,
  onThemeApplied,
}: ThemePanelProps) {
  const [tab, setTab] = useState<Tab>("presets");
  const [description, setDescription] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [applying, setApplying] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(`theme_preset_${documentId}`);
        return stored || null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const applyPreset = async (presetId: string) => {
    setApplying(true);
    setSelectedPreset(presetId);
    try {
      sessionStorage.setItem(`theme_preset_${documentId}`, presetId);
    } catch {}
    try {
      const res = await fetch(
        `/api/bff/ai/documents/${documentId}/theme/preset`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preset_id: presetId }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { log_id?: string };
        if (data.log_id) onThemeApplied(data.log_id);
      }
    } finally {
      setApplying(false);
    }
  };

  const generateTheme = async () => {
    if (!description.trim()) return;
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
      if (res.ok) {
        const data = (await res.json()) as { log_id?: string };
        if (data.log_id) onThemeApplied(data.log_id);
        setDescription("");
      }
    } finally {
      setApplying(false);
    }
  };

  const applyCustomCss = async () => {
    if (!customCss.trim()) return;
    setApplying(true);
    try {
      const res = await fetch(
        `/api/bff/ai/documents/${documentId}/theme`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ css: customCss, theme_name: "custom" }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { log_id?: string };
        if (data.log_id) onThemeApplied(data.log_id);
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-white/[0.06]">
        {(["presets", "generate", "custom"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
              tab === t
                ? "text-white border-b-2 border-orange-500"
                : "text-[#555] hover:text-white/70"
            }`}
          >
            {t === "presets"
              ? "Presets"
              : t === "generate"
                ? "AI Gen"
                : "Custom"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "presets" && (
          <div className="grid grid-cols-1 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                disabled={applying}
                className={`w-full rounded-lg border p-3 text-left transition-all ${
                  selectedPreset === preset.id
                    ? "border-orange-500/60 bg-orange-500/10"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                } disabled:opacity-40`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/90">
                    {preset.name}
                  </span>
                  <div className="flex gap-1">
                    {preset.colors.map((c, i) => (
                      <span
                        key={i}
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-[#555]">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        )}

        {tab === "generate" && (
          <div className="space-y-3">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the style you want..."
              className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5 text-sm text-[#ededed] outline-none transition-all placeholder:text-[#555] focus:border-orange-500/50 focus:bg-white/[0.04]"
            />
            <button
              onClick={generateTheme}
              disabled={applying || !description.trim()}
              className="w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {applying ? "Generating..." : "Generate Theme"}
            </button>
          </div>
        )}

        {tab === "custom" && (
          <div className="space-y-3">
            <textarea
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              placeholder="h1 { font-size: 24pt; color: navy; }"
              className="min-h-32 w-full resize-none rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5 font-mono text-xs text-[#ededed] outline-none transition-all placeholder:text-[#555] focus:border-orange-500/50 focus:bg-white/[0.04]"
            />
            <button
              onClick={applyCustomCss}
              disabled={applying || !customCss.trim()}
              className="w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {applying ? "Applying..." : "Apply CSS"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
