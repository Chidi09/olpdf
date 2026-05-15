import { describe, expect, it } from "vitest";
import { expandPageDecorations } from "./pageDecorations";
import type { PageLayoutDocument } from "@/types/pageLayout";

function makeDoc(overrides?: Partial<PageLayoutDocument>): PageLayoutDocument {
  return {
    id: "doc-1",
    source: { kind: "writer_doc" },
    pages: [
      { id: "p0", index: 0, width: 612, height: 792, objects: [] },
      { id: "p1", index: 1, width: 612, height: 792, objects: [] },
      { id: "p2", index: 2, width: 612, height: 792, objects: [] },
    ],
    styles: {},
    fonts: {},
    assets: {},
    revisions: [],
    ...overrides,
  };
}

describe("expandPageDecorations", () => {
  it("adds header to all pages", () => {
    const doc = makeDoc({
      pageDecorations: {
        header: { text: "Draft", fontSize: 10, fontFamily: "Inter", color: "#999", position: "center" },
      },
    });
    const pages = expandPageDecorations(doc);
    expect(pages[0].objects).toHaveLength(1);
    expect(pages[1].objects).toHaveLength(1);
    expect(pages[0].objects[0].type).toBe("text");
    expect((pages[0].objects[0] as any).content).toBe("Draft");
  });

  it("adds page numbers with n of m format", () => {
    const doc = makeDoc({
      pageDecorations: {
        pageNumbers: { position: "bottom_center", format: "page_n_of_m" },
      },
    });
    const pages = expandPageDecorations(doc);
    expect((pages[0].objects[0] as any).content).toBe("Page 1 of 3");
    expect((pages[1].objects[0] as any).content).toBe("Page 2 of 3");
  });

  it("excludes first page when excludeFirstPage is true", () => {
    const doc = makeDoc({
      pageDecorations: {
        header: { text: "Confidential", fontSize: 10, fontFamily: "Inter", color: "#999", position: "center", excludeFirstPage: true },
      },
    });
    const pages = expandPageDecorations(doc);
    expect(pages[0].objects).toHaveLength(0);
    expect(pages[1].objects).toHaveLength(1);
  });

  it("returns original pages when no decorations", () => {
    const doc = makeDoc();
    const pages = expandPageDecorations(doc);
    expect(pages[0].objects).toHaveLength(0);
  });
});
