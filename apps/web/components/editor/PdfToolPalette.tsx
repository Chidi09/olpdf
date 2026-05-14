"use client";

import { useState, type ReactNode } from "react";
import {
  CursorArrowRaysIcon, StopIcon, RectangleGroupIcon,
  EllipsisHorizontalCircleIcon, MinusIcon, ArrowLongRightIcon,
  PencilSquareIcon, ClipboardDocumentIcon, PencilIcon,
  LightBulbIcon, ClipboardDocumentCheckIcon, Squares2X2Icon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { GlassTooltip } from "@/components/ui/GlassTooltip";

export type CanvasTool =
  | "select" | "rect" | "roundedRect" | "ellipse"
  | "line" | "arrow" | "text" | "sticky" | "draw";

interface ToolDef {
  tool: CanvasTool;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  shortcut: string;
  canvasOnly?: boolean;
}

const DRAWING_TOOLS: ToolDef[] = [
  { tool: "select",      Icon: CursorArrowRaysIcon,         label: "Select",       shortcut: "V" },
  { tool: "rect",        Icon: StopIcon,                    label: "Rectangle",    shortcut: "R",   canvasOnly: true },
  { tool: "roundedRect", Icon: RectangleGroupIcon,          label: "Rounded rect", shortcut: "⇧R", canvasOnly: true },
  { tool: "ellipse",     Icon: EllipsisHorizontalCircleIcon,label: "Ellipse",      shortcut: "O",   canvasOnly: true },
  { tool: "line",        Icon: MinusIcon,                   label: "Line",         shortcut: "L",   canvasOnly: true },
  { tool: "arrow",       Icon: ArrowLongRightIcon,          label: "Arrow",        shortcut: "A",   canvasOnly: true },
  { tool: "text",        Icon: PencilSquareIcon,            label: "Text",         shortcut: "T" },
  { tool: "sticky",      Icon: ClipboardDocumentIcon,       label: "Sticky note",  shortcut: "S",   canvasOnly: true },
  { tool: "draw",        Icon: PencilIcon,                  label: "Freehand",     shortcut: "P",   canvasOnly: true },
];

interface PdfToolPaletteProps {
  mode: "editable" | "fidelity";
  activeTool?: CanvasTool;
  onToolSelect?: (tool: CanvasTool) => void;
  children?: ReactNode;
}

export default function PdfToolPalette({ mode, activeTool, onToolSelect, children }: PdfToolPaletteProps) {
  const [localTool, setLocalTool] = useState<CanvasTool>("select");
  const currentTool = activeTool ?? localTool;

  const handleToolClick = (tool: CanvasTool) => {
    if (onToolSelect) {
      onToolSelect(tool);
    } else {
      setLocalTool(tool);
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-[var(--bg-elevated)] px-2 py-1.5 shadow-[0_1px_0_inset_rgb(255_255_255/6%),0_8px_24px_-8px_rgb(0_0_0/50%)] backdrop-blur-xl">
      {/* Group 1: Drawing tools */}
      {DRAWING_TOOLS.map(({ tool, Icon, label, shortcut, canvasOnly }) => {
        const isDisabled = mode === "editable" && canvasOnly;
        return (
          <GlassTooltip key={tool} label={isDisabled ? `${label} (canvas only)` : label} shortcut={isDisabled ? undefined : shortcut} placement="bottom">
            <button
              onClick={() => !isDisabled && handleToolClick(tool)}
              disabled={isDisabled}
              aria-label={label}
              aria-pressed={currentTool === tool}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                isDisabled
                  ? "text-[var(--text-tertiary)]/30 cursor-not-allowed"
                  : currentTool === tool
                    ? "bg-white/10 text-white ring-1 ring-white/20"
                    : "text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          </GlassTooltip>
        );
      })}

      <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />

      {/* Group 2: Modes */}
      {mode === "fidelity" && (
        <>
          <GlassTooltip label="Suggest mode" placement="bottom">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]">
              <LightBulbIcon className="h-4 w-4" />
            </button>
          </GlassTooltip>
          <GlassTooltip label="Form mode" placement="bottom">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]">
              <ClipboardDocumentCheckIcon className="h-4 w-4" />
            </button>
          </GlassTooltip>
        </>
      )}

      {mode === "editable" && (
        <GlassTooltip label="AI tools in sidebar" placement="bottom">
          <span className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] text-[var(--text-tertiary)]">
            <SparklesIcon className="h-3.5 w-3.5" /> AI
          </span>
        </GlassTooltip>
      )}

      {children && (
        <>
          <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />
          {children}
        </>
      )}
    </div>
  );
}
