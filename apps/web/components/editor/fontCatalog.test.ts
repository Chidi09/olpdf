import { describe, expect, it } from "vitest";
import { getCatalogFonts, getFontById, getFontsByCategory } from "./fontCatalog";

describe("fontCatalog", () => {
  it("contains at least 30 curated fonts", () => {
    const fonts = getCatalogFonts();
    expect(fonts.length).toBeGreaterThan(30);
  });

  it("includes Inter as the first sans-serif entry", () => {
    const sans = getFontsByCategory("sans-serif");
    expect(sans[0].id).toBe("inter");
    expect(sans[0].cssFamily).toBe("Inter");
  });

  it("looks up a font by id", () => {
    const font = getFontById("playfair-display");
    expect(font).toBeDefined();
    expect(font?.category).toBe("serif");
  });

  it("has required fields on every entry", () => {
    for (const font of getCatalogFonts()) {
      expect(font.id).toBeTruthy();
      expect(font.displayName).toBeTruthy();
      expect(font.cssFamily).toBeTruthy();
      expect(["sans-serif", "serif", "monospace", "display", "handwriting"]).toContain(font.category);
    }
  });
});
