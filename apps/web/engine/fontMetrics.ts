/**
 * Browser-side font metric collection.
 *
 * Measures per-character advance widths using Canvas 2D (OffscreenCanvas).
 * The resulting FontMetricsTable can be attached to export requests so the
 * backend uses the exact same character widths the browser computed — closing
 * the WYSIWYG gap between canvas layout and PDF output.
 */

import type { FontMeta } from "@olpdf/document-model";

// 95 printable ASCII + common typographic extras
const PRINTABLE_ASCII = Array.from({ length: 95 }, (_, i) =>
  String.fromCharCode(i + 32),
).join("");
const EXTRA_CHARS = "—–“”‘’…©®™°";
export const SAMPLE_CHARS = PRINTABLE_ASCII + EXTRA_CHARS;

export type CharWidthTable = Record<string, number>; // char → advance width (px @ font size)
export type FontMetricsTable = Record<string, CharWidthTable>; // cssFont → CharWidthTable

function _cssFont(meta: Partial<FontMeta>): string {
  const style = meta.is_italic ? "italic" : "normal";
  const weight = meta.is_bold ? "bold" : "normal";
  const size = meta.size ?? 11;
  const family = meta.family ?? "sans-serif";
  return `${style} ${weight} ${size}px "${family}"`;
}

let _sharedCtx: OffscreenCanvasRenderingContext2D | null = null;

function _getCtx(): OffscreenCanvasRenderingContext2D | null {
  if (_sharedCtx) return _sharedCtx;
  try {
    _sharedCtx = new OffscreenCanvas(1, 1).getContext(
      "2d",
    ) as OffscreenCanvasRenderingContext2D;
    return _sharedCtx;
  } catch {
    return null;
  }
}

/**
 * Collect per-character advance widths for the given font variants.
 * Returns a table keyed by CSS font string that can be JSON-serialised
 * and sent to the export service.
 */
export function collectFontMetrics(
  fontMetas: Array<Partial<FontMeta>>,
  chars: string = SAMPLE_CHARS,
): FontMetricsTable {
  const ctx = _getCtx();
  if (!ctx) return {};

  const table: FontMetricsTable = {};
  const seen = new Set<string>();

  for (const meta of fontMetas) {
    const key = _cssFont(meta);
    if (seen.has(key)) continue;
    seen.add(key);

    ctx.font = key;
    table[key] = {};
    for (const ch of chars) {
      table[key][ch] = ctx.measureText(ch).width;
    }
  }
  return table;
}

/**
 * Look up a character's advance width from a pre-collected table.
 * Returns null when the font or character is not in the table.
 */
export function lookupCharWidth(
  char: string,
  meta: Partial<FontMeta>,
  table: FontMetricsTable,
): number | null {
  const key = _cssFont(meta);
  return table[key]?.[char] ?? null;
}

/**
 * Measure a string using the metrics table (falls back to character-level sum).
 * Useful for the backend to replicate browser line-break decisions.
 */
export function measureStringFromTable(
  text: string,
  meta: Partial<FontMeta>,
  table: FontMetricsTable,
): number | null {
  const key = _cssFont(meta);
  const entry = table[key];
  if (!entry) return null;
  let total = 0;
  for (const ch of text) {
    const w = entry[ch];
    if (w === undefined) return null; // character not in table
    total += w;
  }
  return total;
}

/**
 * Derive a compact FontMeta array from all unique fonts in a DocumentModel's
 * blocks, ready to pass to collectFontMetrics().
 */
export function fontsFromBlocks(
  blocks: Array<{ font_meta?: Partial<FontMeta> | null }>,
): Array<Partial<FontMeta>> {
  const seen = new Set<string>();
  const metas: Array<Partial<FontMeta>> = [];

  for (const block of blocks) {
    if (!block.font_meta) continue;
    const key = _cssFont(block.font_meta);
    if (seen.has(key)) continue;
    seen.add(key);
    metas.push(block.font_meta);
    // Also add bold / italic variants so mixed-formatting spans are covered
    metas.push({ ...block.font_meta, is_bold: true });
    metas.push({ ...block.font_meta, is_italic: true });
    metas.push({ ...block.font_meta, is_bold: true, is_italic: true });
  }
  return metas;
}
