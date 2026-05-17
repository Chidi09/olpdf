import type { PdfDocumentTree, PdfGlyph, PdfStructuredPage } from "@/types/nativePdf";
import { clusterGlyphsIntoRuns } from "./reconstructRuns";
import { groupRunsIntoLines } from "./reconstructLines";
import { groupLinesIntoParagraphBlocks } from "./reconstructParagraphs";

export type PageInput = {
  pageIndex: number;
  width: number;
  height: number;
  glyphs: PdfGlyph[];
};

export function reconstructDocumentTree(
  documentId: string,
  pages: PageInput[]
): PdfDocumentTree {
  const structuredPages: PdfStructuredPage[] = pages.map((page) => {
    const runs = clusterGlyphsIntoRuns(page.glyphs);
    const lines = groupRunsIntoLines(runs);
    const blocks = groupLinesIntoParagraphBlocks(page.pageIndex, lines);

    return {
      pageIndex: page.pageIndex,
      width: page.width,
      height: page.height,
      blocks,
    };
  });

  return {
    documentId,
    pages: structuredPages,
    operations: [],
  };
}
