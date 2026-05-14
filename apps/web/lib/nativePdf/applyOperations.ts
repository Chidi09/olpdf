import type { PdfEditOperation, PdfEditSession } from "@/types/nativePdf";

export function applyOperationToSession(session: PdfEditSession, operation: PdfEditOperation): PdfEditSession {
  const objects = session.objects
    .filter((object) => !(operation.type === "delete_object" && object.id === operation.targetObjectId))
    .map((object) => {
      if (object.id !== operation.targetObjectId) return object;
      if (operation.type === "replace_text") {
        return { ...object, text: String(operation.after.text ?? object.text ?? "") };
      }
      if (operation.type === "move_object" || operation.type === "resize_object") {
        const bbox = operation.after.bbox;
        if (Array.isArray(bbox) && bbox.length === 4) {
          return { ...object, bbox: bbox as [number, number, number, number] };
        }
      }
      return object;
    });

  if (operation.type === "insert_text") {
    const bbox = operation.after.bbox;
    objects.push({
      id: operation.targetObjectId,
      pageIndex: operation.pageIndex,
      type: "text",
      bbox: (Array.isArray(bbox) && bbox.length === 4 ? bbox : [0, 0, 0, 0]) as [number, number, number, number],
      text: String(operation.after.text ?? ""),
    });
  }

  return {
    ...session,
    objects,
    operations: [...session.operations, operation],
    lastSyncedAt: new Date().toISOString(),
  };
}
