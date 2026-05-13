import type { DocumentModel as EditorDocumentModel } from "@olpdf/document-model";

type BlockTypeValue =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "callout"
  | "table"
  | "list"
  | "divider"
  | "page_break"
  | "image"
  | "shape";

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
};

type TiptapDoc = {
  type: "doc";
  content: TiptapNode[];
};

const defaultMeta = {
  title: "Untitled Document",
  author: "",
  page_size: "A4" as const,
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  export_standard: "pdf_a" as const,
  layout_mode: "editable" as const,
};

export interface BookChapter {
  id: string;
  book_id: string;
  document_id: string;
  chapter_number: number;
  title: string;
  status: "draft" | "review" | "final";
  word_count: number;
  sort_order: number;
  embedding_indexed: boolean;
}

export interface BookModel {
  id: string;
  user_id: string;
  title: string;
  meta: Record<string, unknown>;
  front_matter: string[];
  back_matter: string[];
  chapters?: BookChapter[];
}

export function createEmptyDocumentModel(documentId: string): EditorDocumentModel {
  return {
    id: documentId,
    meta: defaultMeta,
    styles: {},
    blocks: [],
    page_dimensions: [],
  };
}

function extractNodeText(node: TiptapNode): string {
  if (typeof node.text === "string") {
    return node.text;
  }
  if (!node.content?.length) {
    return "";
  }
  return node.content.map(extractNodeText).join("");
}

function safeExtractBlockContent(content: unknown): string {
  if (content === null || content === undefined) return "";
  if (typeof content === "string") return content;
  if (typeof content === "number" || typeof content === "boolean") return String(content);
  if (Array.isArray(content)) return content.map((c) => safeExtractBlockContent(c)).join(" ");
  if (typeof content === "object") {
    const obj = content as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.content === "string") return obj.content;
    return "";
  }
  return String(content);
}

function normalizeBlockType(type: string, content: unknown): string {
  const t = String(type || "paragraph");
  if (t === "heading") {
    if (content && typeof content === "object" && "level" in (content as Record<string, unknown>)) {
      const level = Number((content as Record<string, unknown>).level) || 1;
      return `heading${Math.min(Math.max(level, 1), 3)}`;
    }
    return "heading1";
  }
  if (["heading1", "heading2", "heading3", "paragraph", "callout", "table", "list", "divider", "page_break", "image", "shape", "bullet_list", "ordered_list", "field"].includes(t)) {
    return t;
  }
  return "paragraph";
}

export function normalizeDocumentBlocks(blocks: Array<Record<string, unknown>> | undefined): Array<Record<string, unknown>> {
  return (blocks || []).map((block) => ({
    ...block,
    type: normalizeBlockType(String(block.type || "paragraph"), block.content),
    content: safeExtractBlockContent(block.content),
  }));
}

function nodeTypeToBlockType(node: TiptapNode): BlockTypeValue {
  if (node.type === "heading") {
    const level = Number(node.attrs?.level ?? 1);
    if (level === 2) return "heading2";
    if (level === 3) return "heading3";
    return "heading1";
  }
  if (node.type === "paragraph") return "paragraph";
  if (node.type === "bulletList" || node.type === "orderedList") return "list";
  if (node.type === "table") return "table";
  if (node.type === "horizontalRule") return "divider";
  return "paragraph";
}

function blockTypeToNodeType(type: string): TiptapNode {
  if (type === "heading" || type === "heading1") return { type: "heading", attrs: { level: 1 }, content: [] };
  if (type === "heading2") return { type: "heading", attrs: { level: 2 }, content: [] };
  if (type === "heading3") return { type: "heading", attrs: { level: 3 }, content: [] };
  if (type === "divider") return { type: "horizontalRule" };
  if (type === "list") {
    return {
      type: "bulletList",
      content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }],
    };
  }
  if (type === "table") {
    return {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [] }] }],
        },
      ],
    };
  }
  return { type: "paragraph", content: [] };
}

export function tiptapToDocumentModel(tiptapDoc: unknown, documentId: string): EditorDocumentModel {
  const doc = tiptapDoc as { content?: TiptapNode[] };
  const content = Array.isArray(doc?.content) ? doc.content : [];

  const blocks = content
    .filter((node) => node?.type)
    .map((node, idx) => {
      const base = {
        id: (node.attrs?.id as string) || `blk_${idx}`,
        type: nodeTypeToBlockType(node),
        confidence_score: 1,
        needs_review: false,
        style_overrides: (node.attrs?.style_overrides as Record<string, unknown>) || {},
        z_index: 0,
        page_index: 0,
        float: "none" as const,
      };

      if (node.type === "imageBlock") {
        return { ...base, type: "image" as const, src: node.attrs?.src as string };
      }
      if (node.type === "shapeBlock") {
        return { ...base, type: "shape" as const, fabric_data: node.attrs };
      }

      return { ...base, content: extractNodeText(node) };
    });

  return {
    id: documentId,
    meta: defaultMeta,
    styles: {},
    blocks,
    page_dimensions: [],
  };
}

export function documentModelToTiptap(model: EditorDocumentModel): TiptapDoc {
  const normalizedBlocks = normalizeDocumentBlocks(model.blocks as unknown as Array<Record<string, unknown>>);

  const content = normalizedBlocks.map((block) => {
    if (block.type === "image") {
      return {
        type: "imageBlock",
        attrs: { id: block.id, src: block.src, float: block.float },
      };
    }
    if (block.type === "shape") {
      return {
        type: "shapeBlock",
        attrs: { id: block.id, ...(block.fabric_data as object), float: block.float },
      };
    }

    const node = blockTypeToNodeType(String(block.type));
    const text = safeExtractBlockContent(block.content);

    if (node.type === "horizontalRule") {
      return { ...node, attrs: { id: block.id, type: block.type } };
    }
    // ... rest of existing logic ...
    return {
      ...node,
      attrs: { ...(node.attrs || {}), id: block.id, type: block.type },
      content: text ? [{ type: "text", text }] : [],
    };
  });

  return {
    type: "doc",
    content,
  };
}
