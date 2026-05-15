import { describe, expect, it } from "vitest";
import { buildLayoutExportPayload } from "./exportPayload";
import type { PageLayoutDocument } from "@/types/pageLayout";

function makeTestLayout(): PageLayoutDocument {
  return {
    id: "doc-1",
    source: { kind: "imported_pdf", originalPdfKey: "documents/doc-1.pdf" },
    pages: [
      {
        id: "page-0",
        index: 0,
        width: 612,
        height: 792,
        objects: [
          {
            id: "obj-1", type: "text", content: "Hello",
            fontFamily: "Inter", fontSize: 12, fontWeight: "normal" as const,
            fontStyle: "normal" as const, underline: false, color: "#111",
            textAlign: "left" as const, lineHeight: 1.25, letterSpacing: 0,
            bullets: false, numbering: false,
            visible: true, locked: false, zIndex: 0, opacity: 1,
            x: 72, y: 100, width: 400, height: 30, rotation: 0,
          },
        ],
      },
    ],
    styles: {},
    fonts: {},
    assets: {},
    revisions: [],
  };
}

describe("buildLayoutExportPayload", () => {
  it("includes source kind and original PDF key", () => {
    const payload = buildLayoutExportPayload(makeTestLayout());
    expect(payload.source_kind).toBe("imported_pdf");
    expect(payload.original_pdf_key).toBe("documents/doc-1.pdf");
  });

  it("maps pages and their objects", () => {
    const payload = buildLayoutExportPayload(makeTestLayout());
    expect(payload.pages).toHaveLength(1);
    expect(payload.pages[0].objects).toHaveLength(1);
    expect(payload.pages[0].objects[0].content).toBe("Hello");
    expect(payload.pages[0].objects[0].type).toBe("text");
  });

  it("sets export strategy", () => {
    const preserve = buildLayoutExportPayload(makeTestLayout(), "preserve_original");
    expect(preserve.export_strategy).toBe("preserve_original");

    const regenerate = buildLayoutExportPayload(makeTestLayout(), "regenerate");
    expect(regenerate.export_strategy).toBe("regenerate");
  });
});
