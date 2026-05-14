import { describe, expect, it } from "vitest";
import { sanitizeDocumentModelForApi } from "./documentModelSanitizer";

describe("sanitizeDocumentModelForApi", () => {
  it("removes frontend-only block fields before backend validation", () => {
    const model = {
      meta: { title: "Doc", layout_mode: "fidelity" },
      blocks: [{ id: "b1", type: "paragraph", content: "Hello", in_table: true, nodeView: { temp: true } }],
      page_dimensions: [{ page_index: 0, width: 612, height: 792 }],
    };

    const sanitized = sanitizeDocumentModelForApi(model as never);
    const blocks = sanitized.blocks as Array<Record<string, unknown>>;

    expect(blocks[0]).not.toHaveProperty("in_table");
    expect(blocks[0]).not.toHaveProperty("nodeView");
    expect(blocks[0]).toMatchObject({ id: "b1", type: "paragraph", content: "Hello" });
  });

  it("preserves backend-supported fidelity fields", () => {
    const model = {
      meta: { title: "Doc", layout_mode: "fidelity" },
      blocks: [{ id: "img1", type: "image", content: "", bounding_box: [0, 0, 1, 1], page_index: 0, fabric_data: { src: "https://x" } }],
      page_dimensions: [],
    };

    const sanitized = sanitizeDocumentModelForApi(model as never);

    expect((sanitized.blocks as Array<Record<string, unknown>>)[0]).toMatchObject({ bounding_box: [0, 0, 1, 1], page_index: 0, fabric_data: { src: "https://x" } });
  });

  it("removes unknown top-level keys", () => {
    const model = {
      meta: { title: "Test" },
      blocks: [],
      page_dimensions: [],
      _cache: "stale",
      userData: { x: 1 },
    };

    const sanitized = sanitizeDocumentModelForApi(model as never);

    expect(sanitized).not.toHaveProperty("_cache");
    expect(sanitized).not.toHaveProperty("userData");
    expect(sanitized).toMatchObject({ meta: { title: "Test" }, blocks: [], page_dimensions: [] });
  });

  it("removes unknown meta keys", () => {
    const model = {
      meta: { title: "Doc", layout_mode: "fidelity", _internal: true, lastOpened: 123 },
      blocks: [],
      page_dimensions: [],
    };

    const sanitized = sanitizeDocumentModelForApi(model as never);

    expect(sanitized.meta).not.toHaveProperty("_internal");
    expect(sanitized.meta).not.toHaveProperty("lastOpened");
    expect(sanitized.meta).toMatchObject({ title: "Doc", layout_mode: "fidelity" });
  });
});
