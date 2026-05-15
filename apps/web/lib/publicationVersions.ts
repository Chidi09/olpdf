import type { PublicationDetail } from "./publications";

function countBlocks(pub: PublicationDetail): number {
  return Array.isArray(pub.snapshot?.blocks) ? pub.snapshot.blocks.length : 0;
}

function countLayoutObjects(pub: PublicationDetail): number {
  const pages = (pub.snapshot?.layout as { pages?: Array<{ objects?: unknown[] }> } | undefined)?.pages ?? [];
  return pages.reduce((sum, page) => sum + (page.objects?.length ?? 0), 0);
}

function formatDelta(delta: number, noun: string): string | null {
  if (delta === 0) return null;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${delta} ${noun}${Math.abs(delta) === 1 ? "" : "s"}`;
}

export function summarizePublicationDiff(previous: PublicationDetail, current: PublicationDetail): string[] {
  return [
    formatDelta(countBlocks(current) - countBlocks(previous), "block"),
    formatDelta(countLayoutObjects(current) - countLayoutObjects(previous), "layout object"),
  ].filter(Boolean) as string[];
}
