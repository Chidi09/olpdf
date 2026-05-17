import type { PdfDocumentOperation, PdfStructuredBlock } from "@/types/nativePdf";

export type ExportPatchPlan =
  | {
      kind: "patch_text_operator";
      sourceRef: string;
      before: string;
      after: string;
    }
  | {
      kind: "overlay_text";
      pageIndex: number;
      bbox: [number, number, number, number];
      text: string;
    }
  | {
      kind: "replace_image_xobject";
      sourceRef: string;
      imageUrl?: string;
    };

function firstSourceRef(block: PdfStructuredBlock): string | undefined {
  if (block.sourceRefs.length > 0) {
    return block.sourceRefs[0].objectRef ?? block.sourceRefs[0].streamRef;
  }
  const firstRun = block.lines?.[0]?.runs?.[0];
  if (firstRun && firstRun.sourceRefs.length > 0) {
    return firstRun.sourceRefs[0].objectRef ?? firstRun.sourceRefs[0].streamRef;
  }
  return undefined;
}

function hasAnySourceRef(block: PdfStructuredBlock): boolean {
  if (block.sourceRefs.length > 0) return true;
  return block.lines?.some((l) => l.runs.some((r) => r.sourceRefs.length > 0)) ?? false;
}

export function planExportPatch(
  block: PdfStructuredBlock,
  operation: PdfDocumentOperation
): ExportPatchPlan {
  if (operation.type === "replace_run_text" || operation.type === "replace_text") {
    const sourceRef = firstSourceRef(block);
    if (sourceRef) {
      return {
        kind: "patch_text_operator",
        sourceRef,
        before: (operation.before as Record<string, unknown>).text as string ?? "",
        after: (operation.after as Record<string, unknown>).text as string ?? "",
      };
    }
    return {
      kind: "overlay_text",
      pageIndex: block.pageIndex,
      bbox: block.bbox,
      text: (operation.after as Record<string, unknown>).text as string ?? "",
    };
  }

  if (operation.type === "replace_image") {
    const sourceRef = firstSourceRef(block);
    return {
      kind: "replace_image_xobject",
      sourceRef: sourceRef ?? "",
      imageUrl: (operation.after as Record<string, unknown>).imageUrl as string | undefined,
    };
  }

  return {
    kind: "overlay_text",
    pageIndex: block.pageIndex,
    bbox: block.bbox,
    text: "",
  };
}
