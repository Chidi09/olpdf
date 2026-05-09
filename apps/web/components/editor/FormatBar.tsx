"use client";

import { useFidelityCanvasStore, type FormatCommand } from "@/store/useFidelityCanvasStore";

const FONTS = [
  "Georgia",
  "Times New Roman",
  "Arial",
  "Helvetica",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Garamond",
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

type Alignment = "left" | "center" | "right" | "justify";

const ALIGN_ICONS: { value: Alignment; label: string }[] = [
  { value: "left",    label: "⬛▬▬" },
  { value: "center",  label: "▬⬛▬" },
  { value: "right",   label: "▬▬⬛" },
  { value: "justify", label: "▬▬▬" },
];

// SVG icons kept inline to avoid extra dependencies
function AlignLeft()    { return <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="2"/><rect x="1" y="6" width="10" height="2"/><rect x="1" y="10" width="14" height="2"/><rect x="1" y="14" width="8" height="2"/></svg>; }
function AlignCenter()  { return <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="2"/><rect x="3" y="6" width="10" height="2"/><rect x="1" y="10" width="14" height="2"/><rect x="4" y="14" width="8" height="2"/></svg>; }
function AlignRight()   { return <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="2"/><rect x="5" y="6" width="10" height="2"/><rect x="1" y="10" width="14" height="2"/><rect x="7" y="14" width="8" height="2"/></svg>; }
function AlignJustify() { return <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><rect x="1" y="2" width="14" height="2"/><rect x="1" y="6" width="14" height="2"/><rect x="1" y="10" width="14" height="2"/><rect x="1" y="14" width="14" height="2"/></svg>; }

const AlignIcons = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify };

function Sep() {
  return <div className="h-5 w-px bg-[var(--border-subtle)] mx-1 shrink-0" />;
}

function ToggleBtn({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-colors ${
        active
          ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-glass-subtle)] hover:text-[var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function NumInput({ value, min, max, step = 1, title, onChange, width = "w-14" }: {
  value: number; min?: number; max?: number; step?: number;
  title: string; onChange: (v: number) => void; width?: string;
}) {
  return (
    <input
      type="number"
      title={title}
      min={min}
      max={max}
      step={step}
      value={Math.round(value * 10) / 10}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
      className={`${width} h-7 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
    />
  );
}

export default function FormatBar() {
  const { selectedBlock, applyFormat } = useFidelityCanvasStore();

  if (!selectedBlock) return null;

  const fmt = (cmd: Partial<FormatCommand>) => applyFormat(cmd as FormatCommand);

  return (
    <div className="mx-auto mb-3 w-full max-w-[1200px] sticky top-[60px] z-30">
      <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 shadow-md flex-wrap">

        {/* Block type badge */}
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded mr-1 shrink-0">
          {selectedBlock.blockType}
        </span>

        <Sep />

        {/* Font family */}
        <select
          title="Font family"
          value={selectedBlock.fontFamily}
          onChange={(e) => fmt({ fontFamily: e.target.value })}
          className="h-7 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] max-w-[130px]"
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        {/* Font size */}
        <div className="relative">
          <select
            title="Font size"
            value={
              FONT_SIZES.includes(Math.round(selectedBlock.fontSize))
                ? Math.round(selectedBlock.fontSize)
                : ""
            }
            onChange={(e) => fmt({ fontSize: Number(e.target.value) })}
            className="h-7 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] w-14"
          >
            {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <Sep />

        {/* Bold */}
        <ToggleBtn active={selectedBlock.isBold} onClick={() => fmt({ isBold: !selectedBlock.isBold })} title="Bold (⌘B)">
          <span className="font-black">B</span>
        </ToggleBtn>

        {/* Italic */}
        <ToggleBtn active={selectedBlock.isItalic} onClick={() => fmt({ isItalic: !selectedBlock.isItalic })} title="Italic (⌘I)">
          <span className="italic font-bold">I</span>
        </ToggleBtn>

        <Sep />

        {/* Alignment */}
        {(["left", "center", "right", "justify"] as Alignment[]).map((a) => {
          const Icon = AlignIcons[a];
          return (
            <ToggleBtn
              key={a}
              active={selectedBlock.alignment === a}
              onClick={() => fmt({ alignment: a })}
              title={`Align ${a}`}
            >
              <Icon />
            </ToggleBtn>
          );
        })}

        <Sep />

        {/* Text color */}
        <div className="relative flex items-center gap-1" title="Text color">
          <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">A</span>
          <label className="w-6 h-6 rounded cursor-pointer border border-[var(--border-subtle)] overflow-hidden relative" title="Text color">
            <div className="absolute inset-0" style={{ backgroundColor: selectedBlock.color }} />
            <input
              type="color"
              value={selectedBlock.color}
              onChange={(e) => fmt({ color: e.target.value })}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
          </label>
        </div>

        <Sep />

        {/* Position & Size */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider shrink-0">X</span>
          <NumInput value={selectedBlock.left}  title="X position" min={0} onChange={(v) => fmt({ left: v })}  width="w-14" />
          <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider shrink-0">Y</span>
          <NumInput value={selectedBlock.top}   title="Y position" min={0} onChange={(v) => fmt({ top: v })}   width="w-14" />
          <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider shrink-0">W</span>
          <NumInput value={selectedBlock.width} title="Width"      min={10} onChange={(v) => fmt({ width: v })} width="w-14" />
        </div>

      </div>
    </div>
  );
}
