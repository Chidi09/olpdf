export function hitTestLayoutObjects<T extends { x: number; y: number; width: number; height: number; zIndex?: number; visible?: boolean }>(
  objects: T[],
  x: number,
  y: number,
): T | null {
  return [...objects]
    .filter((obj) => obj.visible !== false)
    .filter((obj) => x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height)
    .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))[0] ?? null;
}
