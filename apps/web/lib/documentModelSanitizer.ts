const ALLOWED_TOP_KEYS = new Set(["id", "meta", "styles", "blocks", "page_dimensions"]);

const ALLOWED_META_KEYS = new Set(["title", "author", "page_size", "margins", "export_standard", "layout_mode", "color_space", "native_pdf", "original_pdf_key", "native_pdf_session", "import_status"]);

const ALLOWED_BLOCK_KEYS = new Set([
  "id", "type", "content", "rich_spans", "next_block_id", "column_index",
  "alignment", "confidence_score", "needs_review", "bounding_box",
  "style_overrides", "fabric_data", "font_meta", "z_index", "page_index",
]);

function pick<K extends string>(obj: Record<string, unknown>, allowed: Set<K>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (allowed.has(key as K)) {
      const v = obj[key];
      if (v !== undefined) result[key] = v;
    }
  }
  return result;
}

export function sanitizeDocumentModelForApi(model: Record<string, unknown>): Record<string, unknown> {
  const top = pick(model, ALLOWED_TOP_KEYS);

  if (top.meta && typeof top.meta === "object" && !Array.isArray(top.meta)) {
    top.meta = pick(top.meta as Record<string, unknown>, ALLOWED_META_KEYS);
  }

  if (Array.isArray(top.blocks)) {
    top.blocks = top.blocks.map((block) =>
      pick(block as Record<string, unknown>, ALLOWED_BLOCK_KEYS),
    );
  }

  return top;
}
