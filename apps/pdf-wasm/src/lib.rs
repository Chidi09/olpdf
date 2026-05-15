mod blocks;
mod cmap;
mod document;
mod font;
mod hash;
mod layout;
mod lib_helpers;
mod objects;
mod page;
mod types;

pub use document::PdfDocument;

use wasm_bindgen::prelude::*;
use web_sys::window;

use layout::reconstruct_paragraphs;
use page::{get_page_size, parse_page};
use types::{ParseMetrics, ParseResult, PreflightResult, WasmLayoutObject, WasmPageDimension};

#[wasm_bindgen(start)]
pub fn init_hooks() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ── preflight_pdf ─────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn preflight_pdf(data: &[u8]) -> Result<JsValue, JsValue> {
    let doc = lopdf::Document::load_mem(data)
        .map_err(|e| JsValue::from_str(&format!("PDF load error: {e}")))?;
    let pages = doc.get_pages();
    let mut dims: Vec<WasmPageDimension> = Vec::new();
    for (page_num, &page_id) in &pages {
        let page_index = (*page_num as usize).saturating_sub(1);
        let (width, height) = get_page_size(&doc, page_id);
        dims.push(WasmPageDimension { page_index, width, height });
    }
    dims.sort_by_key(|p| p.page_index);
    serde_wasm_bindgen::to_value(&PreflightResult {
        page_count: dims.len(),
        page_dimensions: dims,
    })
    .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
}

// ── parse_pdf ─────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn parse_pdf(data: &[u8]) -> Result<JsValue, JsValue> {
    let perf = window()
        .ok_or_else(|| JsValue::from_str("No window"))?
        .performance()
        .ok_or_else(|| JsValue::from_str("No performance"))?;
    let start = perf.now();

    let doc = lopdf::Document::load_mem(data)
        .map_err(|e| JsValue::from_str(&format!("PDF parse error: {e}")))?;
    let pages = doc.get_pages();

    let mut all_blocks = Vec::new();
    let mut all_layout_objects: Vec<WasmLayoutObject> = Vec::new();
    let mut page_dimensions: Vec<WasmPageDimension> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut total_unmapped = 0usize;
    let mut pages_failed = 0usize;
    let mut total_image_count = 0usize;
    let mut total_missing_fonts = 0usize;

    for (page_num, &page_id) in &pages {
        let page_index = (*page_num as usize).saturating_sub(1);
        let (width, height) = get_page_size(&doc, page_id);
        page_dimensions.push(WasmPageDimension { page_index, width, height });

        let mut vector_paths: Vec<[f64; 4]> = Vec::new();
        let page_blocks = parse_page(
            &doc,
            page_id,
            page_index,
            height,
            width,
            &mut warnings,
            &mut total_unmapped,
            &mut vector_paths,
            &mut total_image_count,
            &mut total_missing_fonts,
        );

        if page_blocks.is_empty() { pages_failed += 1; }

        let result = reconstruct_paragraphs(
            page_blocks,
            vector_paths,
            width,
            page_index,
            &mut warnings,
        );

        // Convert text blocks to layout objects
        for block in &result.blocks {
            all_layout_objects.push(block_to_layout_object(block));
        }
        // Add table layout objects
        all_layout_objects.extend(result.table_objects);

        all_blocks.extend(result.blocks);
    }

    page_dimensions.sort_by_key(|p| p.page_index);

    let duration_ms = perf.now() - start;
    let total_blocks = all_blocks.len();
    let is_likely_scanned =
        total_image_count > 0 && total_blocks < 5 && !pages.is_empty();

    let metrics = ParseMetrics {
        duration_ms,
        total_blocks,
        unmapped_chars: total_unmapped,
        pages_failed,
        warnings,
        image_count: total_image_count,
        missing_fonts_count: total_missing_fonts,
        is_likely_scanned,
    };

    serde_wasm_bindgen::to_value(&ParseResult {
        blocks: all_blocks,
        layout_objects: all_layout_objects,
        page_dimensions,
        metrics,
    })
    .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
}

// ── Block → layout object projection ────────────────────────────────────

fn block_to_layout_object(block: &types::WasmBlock) -> WasmLayoutObject {
    WasmLayoutObject {
        id: block.object_id.clone(),
        object_type: "text".to_string(),
        page_index: block.page_index,
        x: block.bounding_box[0],
        y: block.bounding_box[1],
        width: block.bounding_box[2],
        height: block.bounding_box[3],
        rotation: 0.0,
        z_index: block.z_index,
        source_ref: block.source_ref.clone(),
        original_pdf_object_id: block.object_id.clone(),
        content: Some(block.content.clone()),
        font_family: Some(block.font_meta.family.clone()),
        font_size: Some(block.font_meta.size),
        color: Some(block.font_meta.color.clone()),
        text_align: Some(block.alignment.clone()),
        rows: None,
        field_name: None,
        field_type: None,
        value: None,
        required: None,
    }
}
