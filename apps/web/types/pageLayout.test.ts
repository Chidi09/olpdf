import { describe, expect, it } from "vitest";
import type {
  PageLayoutDocument,
  PageLayoutPage,
  TextFrame,
  ImageFrame,
  LayoutObject,
} from "./pageLayout";

describe("PageLayoutDocument types", () => {
  it("constructs a minimal page-layout document with text and image objects", () => {
    const page: PageLayoutPage = {
      id: "page-1",
      index: 0,
      width: 612,
      height: 792,
      objects: [],
    };

    const textObj: TextFrame = {
      id: "obj-1",
      type: "text",
      name: "Title",
      visible: true,
      locked: false,
      zIndex: 0,
      opacity: 1,
      x: 72,
      y: 100,
      width: 400,
      height: 30,
      rotation: 0,
      content: "Hello PDF",
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: "normal",
      fontStyle: "normal",
      underline: false,
      color: "#111111",
      textAlign: "left",
      lineHeight: 1.25,
      letterSpacing: 0,
      bullets: false,
      numbering: false,
    };

    const imgObj: ImageFrame = {
      id: "obj-2",
      type: "image",
      visible: true,
      locked: false,
      zIndex: 1,
      opacity: 1,
      x: 72,
      y: 200,
      width: 200,
      height: 150,
      rotation: 0,
      src: "https://example.com/photo.png",
    };

    page.objects.push(textObj, imgObj);

    const doc: PageLayoutDocument = {
      id: "doc-1",
      source: { kind: "imported_pdf", originalPdfKey: "documents/doc-1.pdf" },
      pages: [page],
      styles: {},
      fonts: {},
      assets: {},
      revisions: [],
    };

    expect(doc.id).toBe("doc-1");
    expect(doc.source.kind).toBe("imported_pdf");
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0].objects).toHaveLength(2);

    const first = doc.pages[0].objects[0] as LayoutObject;
    expect(first.type).toBe("text");
    if (first.type === "text") {
      expect(first.content).toBe("Hello PDF");
    }

    const second = doc.pages[0].objects[1] as LayoutObject;
    expect(second.type).toBe("image");
    if (second.type === "image") {
      expect(second.src).toBe("https://example.com/photo.png");
    }
  });
});
