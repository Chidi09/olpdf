import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";
import type { PdfEditOperation } from "@/types/nativePdf";

export type CanvasCommand =
  | { type: "replace_text"; blockId: string; text: string }
  | { type: "move_resize"; blockId: string; bbox: [number, number, number, number] }
  | { type: "delete_block"; blockId: string }
  | { type: "insert_block"; block: DocumentBlock }
  | { type: "format_block"; blockId: string; patch: Partial<DocumentBlock> }
  | { type: "replace_blocks"; blocks: DocumentBlock[] };

export function applyCommand(model: DocumentModel, command: CanvasCommand): DocumentModel {
  const blocks = [...(model.blocks ?? [])];

  switch (command.type) {
    case "replace_text": {
      const idx = blocks.findIndex((b) => b.id === command.blockId);
      if (idx === -1) return model;
      return {
        ...model,
        blocks: blocks.map((b, i) => (i === idx ? { ...b, content: command.text } : b)),
      };
    }

    case "move_resize": {
      const idx = blocks.findIndex((b) => b.id === command.blockId);
      if (idx === -1) return model;
      return {
        ...model,
        blocks: blocks.map((b, i) => (i === idx ? { ...b, bounding_box: command.bbox } : b)),
      };
    }

    case "delete_block": {
      const filtered = blocks.filter((b) => b.id !== command.blockId);
      if (filtered.length === blocks.length) return model;
      return { ...model, blocks: filtered };
    }

    case "insert_block": {
      return { ...model, blocks: [...blocks, command.block] };
    }

    case "format_block": {
      const idx = blocks.findIndex((b) => b.id === command.blockId);
      if (idx === -1) return model;
      return {
        ...model,
        blocks: blocks.map((b, i) => (i === idx ? ({ ...b, ...command.patch } as DocumentBlock) : b)),
      };
    }

    case "replace_blocks": {
      return { ...model, blocks: command.blocks };
    }

    default:
      return model;
  }
}

export function nativeOperationFromCommand(
  command: CanvasCommand,
  beforeModel: DocumentModel,
  afterModel: DocumentModel,
  pageIndex: number,
): PdfEditOperation | undefined {

  switch (command.type) {
    case "replace_text": {
      const beforeBlock = beforeModel.blocks?.find((b) => b.id === command.blockId);
      if (!beforeBlock) return undefined;
      return {
        id: crypto.randomUUID(),
        type: "replace_text",
        pageIndex,
        targetObjectId: command.blockId,
        before: { text: (beforeBlock as any).content ?? "" },
        after: { text: command.text },
        createdAt: new Date().toISOString(),
      };
    }

    case "move_resize": {
      const beforeBlock = beforeModel.blocks?.find((b) => b.id === command.blockId);
      if (!beforeBlock) return undefined;
      return {
        id: crypto.randomUUID(),
        type: "move_object",
        pageIndex,
        targetObjectId: command.blockId,
        before: { bbox: (beforeBlock as any).bounding_box },
        after: { bbox: command.bbox },
        createdAt: new Date().toISOString(),
      };
    }

    case "delete_block": {
      const beforeBlock = beforeModel.blocks?.find((b) => b.id === command.blockId);
      if (!beforeBlock) return undefined;
      return {
        id: crypto.randomUUID(),
        type: "delete_object",
        pageIndex,
        targetObjectId: command.blockId,
        before: { block: beforeBlock },
        after: {},
        createdAt: new Date().toISOString(),
      };
    }

    case "insert_block": {
      return {
        id: crypto.randomUUID(),
        type: "insert_text",
        pageIndex,
        targetObjectId: command.block.id,
        before: {},
        after: { block: command.block },
        createdAt: new Date().toISOString(),
      };
    }

    case "format_block": {
      const beforeBlock = beforeModel.blocks?.find((b) => b.id === command.blockId);
      if (!beforeBlock) return undefined;
      return {
        id: crypto.randomUUID(),
        type: "replace_text",
        pageIndex,
        targetObjectId: command.blockId,
        before: { bbox: (beforeBlock as any).bounding_box, text: (beforeBlock as any).content },
        after: { ...command.patch },
        createdAt: new Date().toISOString(),
      };
    }

    default:
      return undefined;
  }
}
