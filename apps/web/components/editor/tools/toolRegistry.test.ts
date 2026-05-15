import { describe, expect, it } from "vitest";
import { getTools, getToolsByCategory, getTool } from "./toolRegistry";

describe("toolRegistry", () => {
  it("contains all milestone 1 tools", () => {
    const tools = getTools();
    const ids = tools.map((t) => t.id);
    expect(ids).toContain("select");
    expect(ids).toContain("insert_text");
    expect(ids).toContain("font");
    expect(ids).toContain("image");
    expect(ids).toContain("table");
    expect(ids).toContain("shape");
    expect(ids).toContain("symbol");
    expect(ids).toContain("header_footer");
    expect(ids).toContain("page_number");
    expect(ids).toContain("reorder_pages");
    expect(ids).toContain("comment");
    expect(ids).toContain("signature");
    expect(ids).toContain("highlight");
  });

  it("groups tools by category", () => {
    const grouped = getToolsByCategory();
    expect(grouped.select.length).toBeGreaterThan(0);
    expect(grouped.text.length).toBeGreaterThan(0);
    expect(grouped.insert.length).toBeGreaterThan(0);
    expect(grouped.annotation.length).toBeGreaterThan(0);
    expect(grouped.page.length).toBeGreaterThan(0);
  });

  it("looks up a tool by id", () => {
    const tool = getTool("insert_text");
    expect(tool).toBeDefined();
    expect(tool?.label).toBe("Text");
    expect(tool?.shortcut).toBe("T");
  });

  it("returns undefined for unknown tool id", () => {
    expect(getTool("nonexistent")).toBeUndefined();
  });

  it("each tool has required fields", () => {
    for (const tool of getTools()) {
      expect(tool.id).toBeTruthy();
      expect(tool.label).toBeTruthy();
      expect(tool.category).toBeTruthy();
      expect(tool.availability).toBeTruthy();
    }
  });
});
