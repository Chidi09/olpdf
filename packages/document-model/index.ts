
import { z } from "zod";

export const BlockType = z.enum([
  "paragraph", "heading1", "heading2", "heading3", "callout", 
  "table", "list", "divider", "page_break", "image"
]);

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
  blocks: z.array(z.object({
    id: z.string(),
    type: BlockType,
    content: z.string().optional(),
    confidence_score: z.number().optional(),
    needs_review: z.boolean().optional(),
    bounding_box: z.array(z.number()).optional(),
    style_overrides: z.record(z.any()).optional()
  }))
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


