/**
 * Layout engine: converts ASTDocument → positioned DocumentBlock[].
 *
 * Core ideas:
 *  - Text measurement via Canvas 2D (or OffscreenCanvas in a worker) — no
 *    character-count guessing, actual pixel widths per font/size/weight combo.
 *  - Greedy word-wrap line breaker: O(n) per node, produces stable results
 *    that match the browser's own line wrapping within ~1px.
 *  - Column-aware layout: each ASTColumn is a vertical channel; nodes overflow
 *    into the next column (via overflow_into) or the next page automatically.
 *  - Floating object exclusion: blocks with float=left|right register an
 *    exclusion zone; the line breaker narrows available width for each line
 *    that overlaps the float's Y range.
 */

import type {
  ASTColumn,
  ASTDocument,
  ASTNode,
  ASTSpan,
  DocumentBlock,
  DocumentModel,
  FontMeta,
} from "@olpdf/document-model";

// ─── Canvas text measurement ──────────────────────────────────────────────────

let _ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

function _getCtx(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  if (_ctx) return _ctx;
  try {
    _ctx = new OffscreenCanvas(1, 1).getContext("2d") as OffscreenCanvasRenderingContext2D;
    return _ctx;
  } catch {
    if (typeof document !== "undefined") {
      _ctx = document.createElement("canvas").getContext("2d");
      return _ctx;
    }
  }
  return null;
}

function _cssFont(meta: Partial<FontMeta>): string {
  const weight = meta.is_bold ? "bold" : "normal";
  const style = meta.is_italic ? "italic" : "normal";
  const size = meta.size ?? 11;
  const family = meta.family ?? "sans-serif";
  return `${style} ${weight} ${size}px "${family}"`;
}

const _measureCache = new Map<string, number>();

export function measureTextWidth(text: string, meta: Partial<FontMeta>): number {
  if (!text) return 0;
  const key = `${_cssFont(meta)}|${text}`;
  if (_measureCache.has(key)) return _measureCache.get(key)!;

  const ctx = _getCtx();
  let width: number;
  if (ctx) {
    ctx.font = _cssFont(meta);
    width = ctx.measureText(text).width;
  } else {
    // Fallback: average character width heuristic
    width = text.length * (meta.size ?? 11) * (meta.is_bold ? 0.62 : 0.55);
  }

  // Bound cache size to avoid unbounded growth in long sessions
  if (_measureCache.size > 8000) _measureCache.clear();
  _measureCache.set(key, width);
  return width;
}

// ─── Word-unit tokeniser ──────────────────────────────────────────────────────

interface WordUnit {
  text: string;
  isSpace: boolean;
  font: Partial<FontMeta>;
  width: number;
}

function _spansToWordUnits(spans: ASTSpan[], nodeFontMeta: Partial<FontMeta>): WordUnit[] {
  const units: WordUnit[] = [];
  for (const span of spans) {
    const font: Partial<FontMeta> = {
      family: span.font_family ?? nodeFontMeta.family,
      size: span.font_size ?? nodeFontMeta.size ?? 11,
      is_bold: span.bold ?? nodeFontMeta.is_bold,
      is_italic: span.italic ?? nodeFontMeta.is_italic,
      color: span.color ?? nodeFontMeta.color,
    };
    const tokens = span.text.match(/\S+|\s+/g) ?? [];
    for (const token of tokens) {
      units.push({
        text: token,
        isSpace: /^\s+$/.test(token),
        font,
        width: measureTextWidth(token, font),
      });
    }
  }
  return units;
}

// ─── Greedy line breaker ──────────────────────────────────────────────────────

export interface LayoutLine {
  units: WordUnit[];
  totalWidth: number;
  lineHeight: number;
  ascent: number;
}

/**
 * Break word units into lines within `maxWidth`.
 * `exclusions` is a list of [startY, endY, reductionPx] — horizontal width
 * reductions for lines whose Y range overlaps a floating object.
 */
export function greedyLineBreak(
  units: WordUnit[],
  baseMaxWidth: number,
  startY: number,
  lineHeight: number,
  exclusions: Array<[number, number, number]> = [],
): LayoutLine[] {
  const lines: LayoutLine[] = [];
  let current: WordUnit[] = [];
  let lineWidth = 0;
  let lineY = startY;

  function effectiveWidth(): number {
    let reduction = 0;
    for (const [y0, y1, px] of exclusions) {
      if (lineY < y1 && lineY + lineHeight > y0) reduction = Math.max(reduction, px);
    }
    return Math.max(baseMaxWidth - reduction, baseMaxWidth * 0.3);
  }

  function flushLine(): void {
    // Trim trailing whitespace
    while (current.length > 0 && current[current.length - 1].isSpace) current.pop();
    if (current.length === 0) return;

    const lh = current.reduce((m, u) => Math.max(m, (u.font.size ?? 11) * 1.2), lineHeight);
    const asc = current.reduce((m, u) => Math.max(m, (u.font.size ?? 11) * 0.75), 0);
    lines.push({ units: current, totalWidth: lineWidth, lineHeight: lh, ascent: asc });
    lineY += lh;
    current = [];
    lineWidth = 0;
  }

  for (const unit of units) {
    if (unit.isSpace && current.length === 0) continue; // skip leading space on line

    if (lineWidth + unit.width > effectiveWidth() && current.length > 0) {
      flushLine();
      if (unit.isSpace) continue;
    }

    current.push(unit);
    lineWidth += unit.width;
  }

  flushLine();
  return lines;
}

// ─── Node → height estimate (pre-layout) ─────────────────────────────────────

export function estimateNodeHeight(node: ASTNode, columnWidth: number): number {
  if (node.spans.length === 0) return (node.font_meta?.size ?? 11) * 1.2;
  const units = _spansToWordUnits(node.spans, node.font_meta ?? {});
  const fontSize = node.font_meta?.size ?? 11;
  const lines = greedyLineBreak(units, columnWidth, 0, fontSize * 1.2);
  return lines.reduce((sum, l) => sum + l.lineHeight, 0) || fontSize * 1.2;
}

// ─── AST → DocumentBlock[] ────────────────────────────────────────────────────

interface LayoutContext {
  margins: { top: number; bottom: number; left: number; right: number };
  pageDims: Map<number, { width: number; height: number }>;
  defaultPageDim: { width: number; height: number };
  floats: Array<{ pageIndex: number; y0: number; y1: number; x: number; side: "left" | "right"; width: number }>;
}

function _blockFromNode(
  node: ASTNode,
  bbox: [number, number, number, number],
  pageIndex: number,
  columnIndex: number,
): DocumentBlock {
  return {
    id: node.id,
    type: node.type,
    content: node.spans.map((s) => s.text).join(""),
    rich_spans: node.spans,
    next_block_id: node.next_node_id,
    prev_block_id: node.prev_node_id,
    bounding_box: bbox,
    page_index: pageIndex,
    column_index: columnIndex,
    font_meta: node.font_meta,
    alignment: node.alignment,
    style_overrides: node.style_overrides,
    table_data: node.table_data,
    float: node.float ?? "none",
    wrap_polygon: node.wrap_polygon,
    z_index: 0,
    confidence_score: 1.0,
    needs_review: false,
  } as DocumentBlock;
}

function _layoutColumn(
  column: ASTColumn,
  colIdx: number,
  pageIndex: number,
  ctx: LayoutContext,
  overflowNodes: ASTNode[],
): { blocks: DocumentBlock[]; overflow: ASTNode[] } {
  const pageDim = ctx.pageDims.get(pageIndex) ?? ctx.defaultPageDim;
  const maxY = pageDim.height - ctx.margins.bottom;
  const blocks: DocumentBlock[] = [];
  const overflow: ASTNode[] = [];

  let cursorY = ctx.margins.top;

  // Build float exclusions for this column's x range
  const exclusions: Array<[number, number, number]> = ctx.floats
    .filter((f) => f.pageIndex === pageIndex)
    .map((f) => [f.y0, f.y1, f.width + 8]);

  const nodesToLayout: ASTNode[] = [...column.nodes, ...overflowNodes];

  for (const node of nodesToLayout) {
    const colWidth = column.width;
    const units = _spansToWordUnits(
      node.spans.length > 0
        ? node.spans
        : [{ text: node.content ?? "", bold: false, italic: false, underline: false, strikethrough: false, mark: false }],
      node.font_meta ?? {},
    );

    const fontSize = node.font_meta?.size ?? 11;
    const lines = greedyLineBreak(units, colWidth, cursorY, fontSize * 1.2, exclusions);

    if (lines.length === 0) {
      // Empty node — still occupies space (paragraph gap)
      cursorY += fontSize * 1.4;
      continue;
    }

    const nodeHeight = lines.reduce((s, l) => s + l.lineHeight, 0);
    const marginBottom = fontSize * 0.4;

    if (cursorY + nodeHeight > maxY) {
      overflow.push(node);
      continue;
    }

    const y0 = cursorY;
    const y1 = cursorY + nodeHeight;

    // Register floats so subsequent nodes wrap around them
    if (node.float === "left") {
      ctx.floats.push({
        pageIndex,
        y0,
        y1,
        x: column.x,
        side: "left",
        width: colWidth * 0.4,
      });
    } else if (node.float === "right") {
      ctx.floats.push({
        pageIndex,
        y0,
        y1,
        x: column.x + colWidth * 0.6,
        side: "right",
        width: colWidth * 0.4,
      });
    }

    blocks.push(_blockFromNode(node, [column.x, y0, column.x + colWidth, y1], pageIndex, colIdx));
    cursorY = y1 + marginBottom;
  }

  return { blocks, overflow };
}

export interface ASTLayoutResult {
  blocks: DocumentBlock[];
  page_dimensions: Array<{ page_index: number; width: number; height: number }>;
}

export function layoutAST(
  ast: ASTDocument,
  existingDimensions: DocumentModel["page_dimensions"],
): ASTLayoutResult {
  const margins = ast.margins ?? { top: 56, bottom: 56, left: 72, right: 72 };
  const pageDims = new Map<number, { width: number; height: number }>(
    (existingDimensions ?? []).map((d) => [d.page_index, { width: d.width, height: d.height }]),
  );
  const defaultPageDim = { width: 595.28, height: 841.89 };

  const ctx: LayoutContext = { margins, pageDims, defaultPageDim, floats: [] };
  const allBlocks: DocumentBlock[] = [];
  const columnOverflows = new Map<string, ASTNode[]>();

  for (const section of ast.sections) {
    let pageIndex = section.page_index ?? 0;

    for (let ci = 0; ci < section.columns.length; ci++) {
      const column = section.columns[ci];
      const pendingOverflow = columnOverflows.get(column.id) ?? [];

      const { blocks, overflow } = _layoutColumn(column, ci, pageIndex, ctx, pendingOverflow);
      allBlocks.push(...blocks);

      if (overflow.length > 0) {
        if (column.overflow_into) {
          const prev = columnOverflows.get(column.overflow_into) ?? [];
          columnOverflows.set(column.overflow_into, [...prev, ...overflow]);
        } else {
          // Overflow to next page as a synthetic single-column section
          const nextPage = pageIndex + 1;
          if (!pageDims.has(nextPage)) {
            const dim = pageDims.get(pageIndex) ?? defaultPageDim;
            pageDims.set(nextPage, dim);
          }
          const syntheticCol: ASTColumn = {
            id: `${column.id}_p${nextPage}`,
            x: column.x,
            width: column.width,
            nodes: overflow,
          };
          const { blocks: ob } = _layoutColumn(syntheticCol, ci, nextPage, ctx, []);
          allBlocks.push(...ob);
          pageIndex = nextPage;
        }
      }
    }
  }

  return {
    blocks: allBlocks,
    page_dimensions: Array.from(pageDims.entries()).map(([page_index, d]) => ({
      page_index,
      width: d.width,
      height: d.height,
    })),
  };
}

// ─── Flat blocks → AST (backward compat — existing imported PDFs) ─────────────

export function buildASTFromModel(model: DocumentModel): ASTDocument {
  if (model.ast) return model.ast;

  const margins = model.meta?.margins ?? { top: 56, bottom: 56, left: 72, right: 72 };
  const blocks = model.blocks ?? [];

  // Group by page then column, sort by Y within each column
  const byPageCol = new Map<string, DocumentBlock[]>();
  for (const block of blocks) {
    const key = `${block.page_index ?? 0}:${block.column_index ?? 0}`;
    const arr = byPageCol.get(key) ?? [];
    arr.push(block);
    byPageCol.set(key, arr);
  }

  const pageDims = new Map((model.page_dimensions ?? []).map((d) => [d.page_index, d]));
  const pageSet = new Set<number>(blocks.map((b) => b.page_index ?? 0));

  const sections: ASTSection[] = [];
  for (const pageIndex of Array.from(pageSet).sort((a, b) => a - b)) {
    const pageDim = pageDims.get(pageIndex) ?? { page_index: pageIndex, width: 595.28, height: 841.89 };
    const colSet = new Set<number>(
      blocks.filter((b) => (b.page_index ?? 0) === pageIndex).map((b) => b.column_index ?? 0),
    );

    const columns: ASTColumn[] = [];
    for (const colIdx of Array.from(colSet).sort((a, b) => a - b)) {
      const colBlocks = (byPageCol.get(`${pageIndex}:${colIdx}`) ?? []).sort(
        (a, b) => (a.bounding_box?.[1] ?? 0) - (b.bounding_box?.[1] ?? 0),
      );

      const colX = colBlocks.length
        ? Math.min(...colBlocks.map((b) => b.bounding_box?.[0] ?? margins.left))
        : margins.left;
      const colRight = colBlocks.length
        ? Math.max(...colBlocks.map((b) => b.bounding_box?.[2] ?? (pageDim.width - margins.right)))
        : pageDim.width - margins.right;

      const nodes: ASTNode[] = colBlocks.map((block) => ({
        id: block.id,
        type: block.type,
        spans: block.rich_spans?.length
          ? block.rich_spans
          : [{ text: block.content ?? "", bold: false, italic: false, underline: false, strikethrough: false, mark: false }],
        list_level: 0,
        table_data: block.table_data,
        next_node_id: block.next_block_id,
        prev_node_id: block.prev_block_id,
        alignment: block.alignment ?? "left",
        font_meta: block.font_meta,
        style_overrides: block.style_overrides ?? {},
        float: (block as DocumentBlock & { float?: "none" | "left" | "right" }).float ?? "none",
        wrap_polygon: (block as DocumentBlock & { wrap_polygon?: number[] }).wrap_polygon,
      }));

      columns.push({ id: `col_${pageIndex}_${colIdx}`, x: colX, width: colRight - colX, nodes });
    }

    sections.push({ id: `section_${pageIndex}`, page_index: pageIndex, columns, page_break_before: false });
  }

  return { sections, margins };
}

// Types re-exported for consumers that import from the engine
export type { ASTDocument, ASTNode, ASTSection, ASTColumn } from "@olpdf/document-model";
