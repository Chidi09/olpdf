export function shouldPersistFabricObject(obj: { data?: any; type?: string }): boolean {
  const data = obj.data ?? {};
  if (data.isHighlight || data.isOcrBadge || data.isCommentIndicator || data.isCursorOverlay) return false;
  return typeof data.blockId === "string";
}
