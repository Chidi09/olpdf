
import { z } from "zod";

export const BlockType = z.enum([
  "paragraph", "heading1", "heading2", "heading3", "callout",
  "table", "list", "divider", "page_break", "image", "shape", "bullet_list", "ordered_list", "field"
]);

export const FontMeta = z.object({
  family: z.string(),
  size: z.number(),
  color: z.string(),
  is_bold: z.boolean().default(false),
  is_italic: z.boolean().default(false),
});
export type FontMeta = z.infer<typeof FontMeta>;

// ── Inline span (sub-block rich text fragment) ────────────────────────────────
export const ASTSpan = z.object({
  text: z.string(),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  strikethrough: z.boolean().default(false),
  color: z.string().optional(),
  font_family: z.string().optional(),
  font_size: z.number().optional(),
  link_href: z.string().optional(),
  mark: z.boolean().default(false),
});
export type ASTSpan = z.infer<typeof ASTSpan>;

// ── AST node (paragraph-level element in the flow tree) ───────────────────────
export const ASTNode = z.object({
  id: z.string(),
  type: BlockType,
  spans: z.array(ASTSpan).default([]),
  list_level: z.number().int().default(0),
  list_marker: z.string().optional(),
  table_data: z.record(z.any()).optional(),
  // Linked-list flow: text overflows from prev_node_id into this node, surplus
  // continues into next_node_id (enables column-to-column and page-to-page flow)
  next_node_id: z.string().optional(),
  prev_node_id: z.string().optional(),
  alignment: z.enum(["left", "center", "right", "justify"]).default("left"),
  font_meta: FontMeta.optional(),
  style_overrides: z.record(z.any()).default({}),
  src: z.string().optional(),
  float: z.enum(["none", "left", "right"]).default("none"),
  // Polygon of exclusion zone when float !== "none" (for text wrapping)
  wrap_polygon: z.array(z.number()).optional(),
});
export type ASTNode = z.infer<typeof ASTNode>;

// ── Column container (a vertical text channel on a page) ──────────────────────
export const ASTColumn = z.object({
  id: z.string(),
  x: z.number(),
  width: z.number(),
  nodes: z.array(ASTNode),
  // When this column overflows, surplus nodes flow into overflow_into column
  overflow_into: z.string().optional(),
});
export type ASTColumn = z.infer<typeof ASTColumn>;

// ── Section (one logical band across one or more pages) ───────────────────────
export const ASTSection = z.object({
  id: z.string(),
  page_index: z.number().int().default(0),
  columns: z.array(ASTColumn),
  page_break_before: z.boolean().default(false),
});
export type ASTSection = z.infer<typeof ASTSection>;

// ── Full document AST ─────────────────────────────────────────────────────────
export const ASTDocument = z.object({
  sections: z.array(ASTSection),
  default_font: FontMeta.optional(),
  margins: z.object({
    top: z.number(), bottom: z.number(), left: z.number(), right: z.number(),
  }).default({ top: 56, bottom: 56, left: 72, right: 72 }),
});
export type ASTDocument = z.infer<typeof ASTDocument>;

export const DocumentModel = z.object({
  id: z.string().uuid(),
  meta: z.object({
    title: z.string(),
    author: z.string(),
    page_size: z.enum(["A4", "letter"]),
    margins: z.object({ top: z.number(), bottom: z.number(), left: z.number(), right: z.number() }),
    export_standard: z.enum(["pdf_a", "tagged"]),
    layout_mode: z.enum(["editable", "fidelity"])
  }),
  styles: z.any(),
  // Optional authoritative AST — when present the layout engine uses this
  // to derive bounding_box coordinates; the flat blocks[] are a cached view
  ast: ASTDocument.optional(),
  blocks: z.array(z.object({
    id: z.string(),
    type: BlockType,
    content: z.string().optional(),
    // Inline rich spans: enables bold/italic/links within a single block
    rich_spans: z.array(ASTSpan).optional(),
    // Linked flow: overflow text continues into next_block_id
    next_block_id: z.string().optional(),
    prev_block_id: z.string().optional(),
    rich_content: z.record(z.any()).optional(),
    confidence_score: z.number().optional(),
    needs_review: z.boolean().optional(),
    bounding_box: z.array(z.number()).optional(),
    alignment: z.enum(["left", "center", "right", "justify"]).optional(),
    column_index: z.number().int().optional(),
    style_overrides: z.record(z.any()).optional(),
    fabric_data: z.record(z.any()).optional(),
    table_data: z.record(z.any()).optional(),
    field_type: z.enum(["text", "multiline", "checkbox", "radio", "select", "date", "signature"]).optional(),
    field_id: z.string().optional(),
    label: z.string().optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional(),
    default_value: z.string().optional(),
    validation: z.record(z.any()).optional(),
    font_meta: FontMeta.optional(),
    z_index: z.number().int().default(0),
    page_index: z.number().int().default(0),
    // Floating objects: text wraps around blocks with float !== "none"
    float: z.enum(["none", "left", "right"]).default("none"),
    wrap_polygon: z.array(z.number()).optional(),
  })),
  page_dimensions: z.array(z.object({
    page_index: z.number().int(),
    width: z.number(),
    height: z.number(),
  })).default([]),
});

export type DocumentBlock = z.infer<typeof DocumentModel.shape.blocks.element>;
export type DocumentModel = z.infer<typeof DocumentModel>;

export const VersionHistoryEntry = z.object({
  id: z.string().uuid(),
  version_name: z.string().nullable(),
  created_at: z.string().datetime(), // ISO 8601 string from backend
  instruction: z.string(),
});

export type VersionHistoryEntry = z.infer<typeof VersionHistoryEntry>;

export const BookChapter = z.object({
  id: z.string().uuid().optional(),
  document_id: z.string().uuid().optional(),
  chapter_number: z.number().int(),
  title: z.string(),
  status: z.enum(["draft", "review", "final"]).default("draft"),
  word_count: z.number().int().default(0),
});

export type BookChapter = z.infer<typeof BookChapter>;

export const BookModel = z.object({
  id: z.string().uuid().optional(),
  title: z.string(),
  meta: z.record(z.any()).default({}),
  chapters: z.array(BookChapter).default([]),
});

export type BookModel = z.infer<typeof BookModel>;


