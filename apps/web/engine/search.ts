import type { DocumentModel } from "@olpdf/document-model";
import type { Match } from "@/store/useFindReplaceStore";

export function findMatches(
  model: DocumentModel,
  query: string,
  options: { matchCase: boolean; useRegex: boolean },
): Match[] {
  if (!query) return [];

  const matches: Match[] = [];
  const blocks = [...(model.blocks ?? [])].sort((a, b) => {
    if ((a.page_index ?? 0) !== (b.page_index ?? 0)) return (a.page_index ?? 0) - (b.page_index ?? 0);
    return (a.bounding_box?.[1] ?? 0) - (b.bounding_box?.[1] ?? 0);
  });

  let pattern: RegExp;
  try {
    pattern = options.useRegex
      ? new RegExp(query, options.matchCase ? "g" : "gi")
      : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), options.matchCase ? "g" : "gi");
  } catch {
    return [];
  }

  for (const block of blocks) {
    if (!block.content || block.type === "table") continue;
    const text = block.content;
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        blockId: block.id,
        pageIndex: block.page_index ?? 0,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        text: match[0],
      });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }

  return matches;
}

export function replaceMatch(model: DocumentModel, match: Match, replacement: string): DocumentModel {
  const blocks = (model.blocks ?? []).map((b) => {
    if (b.id !== match.blockId || !b.content) return b;
    const newContent = b.content.slice(0, match.startOffset) + replacement + b.content.slice(match.endOffset);
    return { ...b, content: newContent };
  });
  return { ...model, blocks };
}

export function replaceAll(model: DocumentModel, matches: Match[], replacement: string): DocumentModel {
  const sorted = [...matches].sort((a, b) => {
    if (a.blockId !== b.blockId) return a.blockId.localeCompare(b.blockId);
    return b.startOffset - a.startOffset;
  });

  let result = model;
  for (const match of sorted) {
    result = replaceMatch(result, match, replacement);
  }
  return result;
}
