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
  | "image";

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
  if (type === "heading1") return { type: "heading", attrs: { level: 1 }, content: [] };
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
    .map((node, idx) => ({
      id: (node.attrs?.id as string) || `blk_${idx}`,
      type: nodeTypeToBlockType(node),
      content: extractNodeText(node),
      confidence_score: 1,
      needs_review: false,
      style_overrides: (node.attrs?.style_overrides as Record<string, unknown>) || {},
    }));

  return {
    id: documentId,
    meta: defaultMeta,
    styles: {},
    blocks,
  };
}

export function documentModelToTiptap(model: EditorDocumentModel): TiptapDoc {
  const content = (model.blocks || []).map((block) => {
    const node = blockTypeToNodeType(block.type);

    if (node.type === "horizontalRule") {
      return { ...node, attrs: { id: block.id, type: block.type } };
    }

    if (node.type === "bulletList") {
      const text = block.content || "";
      return {
        ...node,
        attrs: { id: block.id, type: block.type },
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
          },
        ],
      };
    }

    return {
      ...node,
      attrs: { ...(node.attrs || {}), id: block.id, type: block.type },
      content: block.content ? [{ type: "text", text: block.content }] : [],
    };
  });

  return {
    type: "doc",
    content,
  };
}
