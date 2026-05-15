import type { PageLayoutDocument, PageLayoutPage, TextFrame } from "@/types/pageLayout";

export function expandPageDecorations(doc: PageLayoutDocument): PageLayoutPage[] {
  const decorations = doc.pageDecorations;
  if (!decorations) return doc.pages;

  const totalPages = doc.pages.length;

  return doc.pages.map((page, idx) => {
    const generatedObjects: TextFrame[] = [];
    const isFirst = idx === 0;

    if (decorations.header && !(isFirst && decorations.header.excludeFirstPage)) {
      generatedObjects.push({
        id: `header-${page.id}`,
        type: "text",
        content: decorations.header.text,
        fontFamily: decorations.header.fontFamily,
        fontSize: decorations.header.fontSize,
        fontWeight: "normal",
        fontStyle: "normal",
        underline: false,
        color: decorations.header.color,
        textAlign: decorations.header.position,
        lineHeight: 1.2,
        letterSpacing: 0,
        bullets: false,
        numbering: false,
        visible: true,
        locked: true,
        zIndex: -1,
        opacity: 0.6,
        x: 50,
        y: 20,
        width: page.width - 100,
        height: 20,
        rotation: 0,
      });
    }

    if (decorations.footer && !(isFirst && decorations.footer.excludeFirstPage)) {
      generatedObjects.push({
        id: `footer-${page.id}`,
        type: "text",
        content: decorations.footer.text,
        fontFamily: decorations.footer.fontFamily,
        fontSize: decorations.footer.fontSize,
        fontWeight: "normal",
        fontStyle: "normal",
        underline: false,
        color: decorations.footer.color,
        textAlign: decorations.footer.position,
        lineHeight: 1.2,
        letterSpacing: 0,
        bullets: false,
        numbering: false,
        visible: true,
        locked: true,
        zIndex: -1,
        opacity: 0.6,
        x: 50,
        y: page.height - 40,
        width: page.width - 100,
        height: 20,
        rotation: 0,
      });
    }

    if (decorations.pageNumbers && !(isFirst && decorations.pageNumbers.excludeFirstPage)) {
      const pageNum = (decorations.pageNumbers.startAt ?? 1) + idx;
      let pageNumText = decorations.pageNumbers.format;
      if (pageNumText.includes("page_n_of_m")) {
        pageNumText = `Page ${pageNum} of ${totalPages}`;
      } else if (pageNumText.includes("page_n")) {
        pageNumText = `Page ${pageNum}`;
      } else if (pageNumText.includes("-n-")) {
        pageNumText = `- ${pageNum} -`;
      } else if (pageNumText.includes("n")) {
        pageNumText = String(pageNum);
      }
      const pos = decorations.pageNumbers.position;
      const isTop = pos.startsWith("top");
      const align = pos.includes("left") ? "left" as const : pos.includes("right") ? "right" as const : "center" as const;
      const px = align === "left" ? 50 : align === "right" ? page.width - 150 : page.width / 2 - 50;

      generatedObjects.push({
        id: `pagenum-${page.id}`,
        type: "text",
        content: pageNumText,
        fontFamily: "Inter",
        fontSize: 10,
        fontWeight: "normal",
        fontStyle: "normal",
        underline: false,
        color: "#666666",
        textAlign: align,
        lineHeight: 1.2,
        letterSpacing: 0,
        bullets: false,
        numbering: false,
        visible: true,
        locked: true,
        zIndex: -1,
        opacity: 0.6,
        x: px,
        y: isTop ? 20 : page.height - 30,
        width: 100,
        height: 14,
        rotation: 0,
      });
    }

    return {
      ...page,
      objects: [...page.objects, ...generatedObjects],
    };
  });
}
