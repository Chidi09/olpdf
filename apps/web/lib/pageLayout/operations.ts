import type { PageLayoutDocument, LayoutObject } from "@/types/pageLayout";

export type LayoutOperation =
  | { type: "insert_text"; pageId: string; object: LayoutObject }
  | { type: "update_text"; pageId: string; objectId: string; content: string }
  | { type: "insert_image"; pageId: string; object: LayoutObject }
  | { type: "insert_table"; pageId: string; object: LayoutObject }
  | { type: "insert_shape"; pageId: string; object: LayoutObject }
  | { type: "insert_symbol"; pageId: string; object: LayoutObject }
  | { type: "add_highlight"; pageId: string; object: LayoutObject }
  | { type: "add_comment"; pageId: string; object: LayoutObject }
  | { type: "add_signature"; pageId: string; object: LayoutObject }
  | { type: "move_object"; pageId: string; objectId: string; x: number; y: number }
  | { type: "resize_object"; pageId: string; objectId: string; width: number; height: number }
  | { type: "delete_object"; pageId: string; objectId: string }
  | { type: "reorder_pages"; fromIndex: number; toIndex: number };

export function operationsFromLayoutDiff(
  original: PageLayoutDocument | null,
  current: PageLayoutDocument,
): LayoutOperation[] {
  const ops: LayoutOperation[] = [];

  if (!original) {
    return ops;
  }

  const origMap = new Map<string, LayoutObject>();
  for (const page of original.pages) {
    for (const obj of page.objects) {
      origMap.set(obj.id, obj);
    }
  }

  const seenIds = new Set<string>();

  for (const page of current.pages) {
    for (const obj of page.objects) {
      seenIds.add(obj.id);
      const origObj = origMap.get(obj.id);
      if (!origObj) {
        if (obj.type === "text") {
          ops.push({ type: "insert_text", pageId: page.id, object: obj });
        } else if (obj.type === "image") {
          ops.push({ type: "insert_image", pageId: page.id, object: obj });
        } else if (obj.type === "table") {
          ops.push({ type: "insert_table", pageId: page.id, object: obj });
        } else if (obj.type === "shape") {
          ops.push({ type: "insert_shape", pageId: page.id, object: obj });
        } else if (obj.type === "symbol") {
          ops.push({ type: "insert_symbol", pageId: page.id, object: obj });
        } else if (obj.type === "annotation") {
          if (obj.annotationType === "highlight") {
            ops.push({ type: "add_highlight", pageId: page.id, object: obj });
          } else if (obj.annotationType === "comment") {
            ops.push({ type: "add_comment", pageId: page.id, object: obj });
          } else if (obj.annotationType === "signature") {
            ops.push({ type: "add_signature", pageId: page.id, object: obj });
          }
        }
      } else {
        if (obj.x !== origObj.x || obj.y !== origObj.y) {
          ops.push({ type: "move_object", pageId: page.id, objectId: obj.id, x: obj.x, y: obj.y });
        }
        if (obj.width !== origObj.width || obj.height !== origObj.height) {
          ops.push({ type: "resize_object", pageId: page.id, objectId: obj.id, width: obj.width, height: obj.height });
        }
        if (obj.type === "text" && origObj.type === "text" && obj.content !== origObj.content) {
          ops.push({ type: "update_text", pageId: page.id, objectId: obj.id, content: obj.content });
        }
      }
    }
  }

  return ops;
}

export function validateLayoutOperations(operations: LayoutOperation[], doc: PageLayoutDocument): string[] {
  const objectIds = new Set(doc.pages.flatMap((page) => page.objects.map((obj) => obj.id)));
  const pageIds = new Set(doc.pages.map((page) => page.id));
  const errors: string[] = [];

  for (const op of operations) {
    if ("pageId" in op && op.pageId !== undefined && !pageIds.has(op.pageId)) {
      errors.push(`${op.type} references missing page ${op.pageId}`);
    }
    if ("objectId" in op && !objectIds.has(op.objectId)) {
      errors.push(`${op.type} references missing object ${op.objectId}`);
    }
    if (op.type === "resize_object" && (op.width <= 0 || op.height <= 0)) {
      errors.push(`resize_object for ${op.objectId} has invalid dimensions`);
    }
  }

  return errors;
}
