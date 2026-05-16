mod blocks;
mod document;
mod font;
mod hash;
mod layout;
mod types;

pub use document::PdfDocument;

use wasm_bindgen::prelude::*;
use web_sys::window;

use layout::reconstruct_paragraphs;
use types::{FontMeta, ParseMetrics, ParseResult, PreflightResult, WasmBlock, WasmLayoutObject, WasmPageDimension};

#[wasm_bindgen(start)]
pub fn init_hooks() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn preflight_pdf(data: &[u8]) -> Result<JsValue, JsValue> {
    let doc = pdf_oxide::PdfDocument::from_bytes(data.to_vec())
        .map_err(|e| JsValue::from_str(&format!("PDF load error: {e}")))?;
    let page_count = doc.page_count()
        .map_err(|e| JsValue::from_str(&format!("Page count error: {e}")))?;
    let mut dims: Vec<WasmPageDimension> = Vec::new();
    for i in 0..page_count {
        let (x1, y1, x2, y2) = doc.get_page_media_box(i)
            .map_err(|e| JsValue::from_str(&format!("Page size error: {e}")))?;
        let w = (x2 - x1).abs() as f64;
        let h = (y2 - y1).abs() as f64;
        dims.push(WasmPageDimension { page_index: i, width: w, height: h });
    }
    serde_wasm_bindgen::to_value(&PreflightResult {
        page_count,
        page_dimensions: dims,
    })
    .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
}

#[wasm_bindgen]
pub fn parse_pdf(data: &[u8]) -> Result<JsValue, JsValue> {
    let perf = window()
        .ok_or_else(|| JsValue::from_str("No window"))?
        .performance()
        .ok_or_else(|| JsValue::from_str("No performance"))?;
    let start = perf.now();

    let doc = pdf_oxide::PdfDocument::from_bytes(data.to_vec())
        .map_err(|e| JsValue::from_str(&format!("PDF parse error: {e}")))?;
    let page_count = doc.page_count()
        .map_err(|e| JsValue::from_str(&format!("Page count error: {e}")))?;

    let mut all_blocks = Vec::new();
    let mut all_layout_objects: Vec<WasmLayoutObject> = Vec::new();
    let mut page_dimensions: Vec<WasmPageDimension> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut total_unmapped = 0usize;
    let mut pages_failed = 0usize;
    let mut total_image_count = 0usize;
    let mut total_missing_fonts = 0usize;

    for page_index in 0..page_count {
        let (x1, y1, x2, y2) = doc.get_page_media_box(page_index)
            .map_err(|e| JsValue::from_str(&format!("Page size error: {e}")))?;
        let width = (x2 - x1).abs() as f64;
        let height = (y2 - y1).abs() as f64;
        page_dimensions.push(WasmPageDimension { page_index, width, height });

        let mut vector_paths: Vec<[f64; 4]> = Vec::new();

        let page_blocks = match parse_page_blocks(&doc, page_index, height, &mut total_image_count, &mut warnings) {
            Ok(blocks) => blocks,
            Err(e) => {
                warnings.push(format!("Page {page_index} parse error: {e}"));
                pages_failed += 1;
                continue;
            }
        };

        if page_blocks.is_empty() { pages_failed += 1; }

        let result = reconstruct_paragraphs(
            page_blocks,
            vector_paths,
            width,
            page_index,
            &mut warnings,
        );

        for block in &result.blocks {
            all_layout_objects.push(block_to_layout_object(block));
        }
        all_layout_objects.extend(result.table_objects);
        all_blocks.extend(result.blocks);
    }

    page_dimensions.sort_by_key(|p| p.page_index);

    let duration_ms = perf.now() - start;
    let total_blocks = all_blocks.len();
    let is_likely_scanned =
        total_image_count > 0 && total_blocks < 5 && page_count > 0;

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

fn parse_page_blocks(
    doc: &pdf_oxide::PdfDocument,
    page_index: usize,
    _page_height: f64,
    image_count: &mut usize,
    _warnings: &mut Vec<String>,
) -> Result<Vec<WasmBlock>, String> {
    let chars = doc.extract_chars(page_index)
        .map_err(|e| format!("extract_chars failed: {e}"))?;
    let images = doc.extract_images(page_index)
        .map_err(|e| format!("extract_images failed: {e}"))?;
    *image_count += images.len();

    let mut blocks: Vec<WasmBlock> = Vec::new();
    let mut block_idx = 0usize;
    let mut current_text = String::new();
    let mut current_font = String::new();
    let mut current_size = 12.0_f64;
    let mut current_color = "#111111".to_string();
    let mut prev_y = 0.0;
    let mut prev_x = 0.0;

    for ch in &chars {
        if !current_text.is_empty() {
            let ch_x = ch.bbox.x as f64;
            let ch_y = ch.bbox.y as f64;
            let y_delta = (prev_y - ch_y).abs();
            let x_delta = (ch_x - prev_x).abs();
            if y_delta > current_size * 0.5 || x_delta > current_size * 2.0 {
                let id = format!("blk_oxide_{page_index}_{block_idx}");
                blocks.push(WasmBlock {
                    id: id.clone(),
                    object_id: id.clone(),
                    source_ref: format!("page:{page_index}:oxide:{block_idx}"),
                    block_type: "text".to_string(),
                    content: std::mem::take(&mut current_text),
                    rich_spans: vec![],
                    next_block_id: None,
                    page_index,
                    bounding_box: [0.0, 0.0, 0.0, 0.0],
                    font_meta: FontMeta {
                        family: current_font.clone(),
                        size: current_size,
                        is_bold: ch.font_weight.is_bold(),
                        is_italic: ch.is_italic,
                        color: current_color.clone(),
                    },
                    alignment: "left".to_string(),
                    confidence_score: 1.0,
                    needs_review: false,
                    z_index: 0,
                    column_index: 0,
                    style_overrides: std::collections::HashMap::new(),
                    bullet: None,
                    is_invisible: false,
                });
                block_idx += 1;
            }
        }

        current_text.push(ch.char);
        current_font = ch.font_name.clone();
        current_size = ch.font_size as f64;
        current_color = format!("#{:02X}{:02X}{:02X}", (ch.color.r * 255.0) as u8, (ch.color.g * 255.0) as u8, (ch.color.b * 255.0) as u8);
        prev_x = ch.bbox.x as f64;
        prev_y = ch.bbox.y as f64;
    }

    if !current_text.is_empty() {
        let id = format!("blk_oxide_{page_index}_{block_idx}");
        blocks.push(WasmBlock {
            id: id.clone(),
            object_id: id,
            source_ref: format!("page:{page_index}:oxide:{block_idx}"),
            block_type: "text".to_string(),
            content: current_text,
            rich_spans: vec![],
            next_block_id: None,
            page_index,
            bounding_box: [0.0, 0.0, 0.0, 0.0],
            font_meta: FontMeta {
                family: current_font,
                size: current_size,
                is_bold: false,
                is_italic: false,
                color: current_color,
            },
            alignment: "left".to_string(),
            confidence_score: 1.0,
            needs_review: false,
            z_index: 0,
            column_index: 0,
            style_overrides: std::collections::HashMap::new(),
            bullet: None,
            is_invisible: false,
        });
    }

    Ok(blocks)
}

fn block_to_layout_object(block: &WasmBlock) -> WasmLayoutObject {
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

#[wasm_bindgen]
pub fn parse_page_by_index(data: &[u8], page_index: usize) -> Result<JsValue, JsValue> {
    let doc = pdf_oxide::PdfDocument::from_bytes(data.to_vec())
        .map_err(|e| JsValue::from_str(&format!("PDF load error: {e}")))?;
    let mut image_count = 0usize;
    let mut warnings = Vec::new();
    let blocks = parse_page_blocks(&doc, page_index, 0.0, &mut image_count, &mut warnings)
        .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&blocks)
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
}

#[wasm_bindgen]
pub fn preflight_streaming(data: &[u8]) -> Result<JsValue, JsValue> {
    let doc = pdf_oxide::PdfDocument::from_bytes(data.to_vec())
        .map_err(|e| JsValue::from_str(&format!("PDF load error: {e}")))?;
    let page_count = doc.page_count()
        .map_err(|e| JsValue::from_str(&format!("Page count error: {e}")))?;
    serde_wasm_bindgen::to_value(&serde_json::json!({
        "total_pages": page_count,
        "chunk_size": 4,
    }))
    .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
}
