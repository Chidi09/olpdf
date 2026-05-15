"use client";

import { useState, type ReactNode } from "react";
import {
  CursorArrowRaysIcon, StopIcon, RectangleGroupIcon,
  EllipsisHorizontalCircleIcon, MinusIcon, ArrowLongRightIcon,
  PencilSquareIcon, ClipboardDocumentIcon, PencilIcon,
  LightBulbIcon, ClipboardDocumentCheckIcon, Squares2X2Icon,
  SparklesIcon, PhotoIcon, TableCellsIcon,
  VariableIcon, DocumentTextIcon, HashtagIcon,
  ArrowsUpDownIcon, ChatBubbleLeftRightIcon,
  PencilSquareIcon as SignatureIcon, SunIcon,
} from "@heroicons/react/24/outline";
import { GlassTooltip } from "@/components/ui/GlassTooltip";
import { getToolsByCategory, getTool, type ToolCategory } from "@/components/editor/tools/toolRegistry";
import type { CanvasToolId } from "@/components/editor/tools/toolRegistry";

export type CanvasTool =
  | "select" | "rect" | "roundedRect" | "ellipse"
  | "line" | "arrow" | "text" | "sticky" | "draw"
  | "image" | "table" | "symbol"
  | "header_footer" | "page_number"
  | "reorder_pages"
  | "comment" | "signature" | "highlight";

interface ToolDef {
  tool: CanvasTool;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  shortcut: string;
  canvasOnly?: boolean;
}

const REGISTRY_ICON_MAP: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  select: CursorArrowRaysIcon,
  insert_text: PencilSquareIcon,
  font: DocumentTextIcon,
  image: PhotoIcon,
  table: TableCellsIcon,
  shape: StopIcon,
  symbol: VariableIcon,
  header_footer: DocumentTextIcon,
  page_number: HashtagIcon,
  reorder_pages: ArrowsUpDownIcon,
  comment: ChatBubbleLeftRightIcon,
  signature: SignatureIcon,
  highlight: SunIcon,
};

function iconForRegistryId(id: string): React.FC<React.SVGProps<SVGSVGElement>> {
  return REGISTRY_ICON_MAP[id] ?? CursorArrowRaysIcon;
}

interface PdfToolPaletteProps {
  mode: "editable" | "fidelity";
  activeTool?: CanvasTool;
  onToolSelect?: (tool: CanvasTool) => void;
  children?: ReactNode;
}

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  select: "Select",
  text: "Text",
  insert: "Insert",
  annotation: "Annotate",
  page: "Page",
  ai: "AI",
};

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

  const renderRegistryButton = (registryId: string) => {
    const def = getTool(registryId);
    if (!def) return null;
    const canvasTool = registryId === "insert_text" ? "text"
      : registryId === "shape" ? "rect"
      : registryId as CanvasTool;
    const Icon = iconForRegistryId(registryId);
    return (
      <GlassTooltip key={registryId} label={def.label} shortcut={def.shortcut} placement="bottom">
        <button
          onClick={() => handleToolClick(canvasTool)}
          aria-label={def.label}
          aria-pressed={currentTool === canvasTool}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            currentTool === canvasTool
              ? "bg-white/10 text-white ring-1 ring-white/20"
              : "text-[var(--text-tertiary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      </GlassTooltip>
    );
  };

  const categoryOrder: ToolCategory[] = ["select", "text", "insert", "annotation", "page"];

  const allToolsByCategory = getToolsByCategory();

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-[var(--bg-elevated)] px-2 py-1.5 shadow-[0_1px_0_inset_rgb(255_255_255/6%),0_8px_24px_-8px_rgb(0_0_0/50%)] backdrop-blur-xl">
      {categoryOrder.map((cat, ci) => {
        const tools = allToolsByCategory[cat];
        if (!tools || tools.length === 0) return null;
        return (
          <span key={cat} className="flex items-center gap-0.5">
            {ci > 0 && <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />}
            {tools.map((t) => renderRegistryButton(t.id))}
          </span>
        );
      })}

      <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />

      {/* Mode-specific extras */}
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
