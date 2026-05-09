//! OLPDF Rust/Wasm PDF parser — instant client-side preview before server enrichment.
//!
//! Parses PDF content streams (BT/ET/Tf/Td/Tm/T*/Tj/TJ/'/") and produces a
//! DocumentModel JSON compatible with the OLPDF block schema.  confidence_score
//! is 0.8; the server-side PyMuPDF pass overwrites it with 1.0 and fills in
//! exact font metadata, color, and column layout.

use std::collections::HashMap;
use lopdf::{content::Content, Document, Object};
use serde::Serialize;
use wasm_bindgen::prelude::*;

// ── Init ──────────────────────────────────────────────────────────────────────

#[wasm_bindgen(start)]
pub fn init_hooks() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct FontMeta {
    family: String,
    size: f64,
    is_bold: bool,
    is_italic: bool,
    color: String,
}

#[derive(Serialize, Clone)]
struct WasmBlock {
    id: String,
    #[serde(rename = "type")]
    block_type: String,
    content: String,
    page_index: usize,
    bounding_box: [f64; 4],
    font_meta: FontMeta,
    alignment: String,
    confidence_score: f64,
    needs_review: bool,
    z_index: usize,
    column_index: usize,
    style_overrides: HashMap<String, String>,
}

#[derive(Serialize)]
struct WasmPageDimension {
    page_index: usize,
    width: f64,
    height: f64,
}

#[derive(Serialize)]
struct ParseResult {
    blocks: Vec<WasmBlock>,
    page_dimensions: Vec<WasmPageDimension>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn obj_f64(obj: &Object) -> f64 {
    match obj {
        Object::Real(f) => *f as f64,
        Object::Integer(i) => *i as f64,
        _ => 0.0,
    }
}

fn decode_pdf_string(bytes: &[u8]) -> String {
    // UTF-16BE BOM: FE FF
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        let words: Vec<u16> = bytes[2..]
            .chunks(2)
            .filter(|c| c.len() == 2)
            .map(|c| ((c[0] as u16) << 8) | (c[1] as u16))
            .collect();
        return String::from_utf16_lossy(&words).to_string();
    }
    std::str::from_utf8(bytes)
        .map(|s| s.to_string())
        .unwrap_or_else(|_| bytes.iter().map(|&b| b as char).collect())
}

/// Strip subset prefix "ABCDEF+FontName" → "FontName"; detect bold/italic from name.
fn parse_font_name(raw: &str) -> (String, bool, bool) {
    let name = if let Some(pos) = raw.find('+') { &raw[pos + 1..] } else { raw };
    let lower = name.to_lowercase();
    (
        name.to_string(),
        lower.contains("bold"),
        lower.contains("italic") || lower.contains("oblique"),
    )
}

fn infer_type(size: f64, avg: f64) -> &'static str {
    let r = size / avg.max(1.0);
    if r >= 1.8 { "heading1" } else if r >= 1.3 { "heading2" } else if r >= 1.1 { "heading3" } else { "paragraph" }
}

/// Build one block record. Returns None if text is blank.
fn make_block(
    text: &str,
    x: f64,
    y: f64,
    font_size: f64,
    font_name: &str,
    page_index: usize,
    page_height: f64,
    idx: usize,
) -> Option<WasmBlock> {
    let t = text.trim();
    if t.is_empty() {
        return None;
    }
    let (family, is_bold, is_italic) = parse_font_name(font_name);
    let sy = (page_height - y - font_size).max(0.0);
    let w = (t.len() as f64 * font_size * 0.5).max(20.0);
    Some(WasmBlock {
        id: format!("blk_wasm_{page_index}_{idx}"),
        block_type: "paragraph".to_string(),
        content: t.to_string(),
        page_index,
        bounding_box: [x.max(0.0), sy, (x + w).max(x + 10.0), (sy + font_size * 1.2).max(sy + 10.0)],
        font_meta: FontMeta { family, size: font_size, is_bold, is_italic, color: "#111111".to_string() },
        alignment: "left".to_string(),
        confidence_score: 0.8,
        needs_review: false,
        z_index: idx,
        column_index: 0,
        style_overrides: HashMap::new(),
    })
}

// ── Page size ─────────────────────────────────────────────────────────────────

fn get_page_size(doc: &Document, page_id: (u32, u16)) -> (f64, f64) {
    let default = (595.28_f64, 841.89_f64);
    let result: Option<(f64, f64)> = (|| {
        let obj = doc.get_object(page_id).ok()?;
        let dict = obj.as_dict().ok()?;
        let mb = dict.get(b"MediaBox").ok()?;
        let arr: Vec<Object> = match mb {
            Object::Array(a) => a.clone(),
            Object::Reference(id) => {
                let id = *id;
                match doc.get_object(id).ok()? {
                    Object::Array(a) => a.clone(),
                    _ => return None,
                }
            }
            _ => return None,
        };
        if arr.len() < 4 {
            return None;
        }
        let w = obj_f64(&arr[2]) - obj_f64(&arr[0]);
        let h = obj_f64(&arr[3]) - obj_f64(&arr[1]);
        if w > 0.0 && h > 0.0 { Some((w, h)) } else { None }
    })();
    result.unwrap_or(default)
}

// ── Content stream parser ─────────────────────────────────────────────────────

fn parse_page(doc: &Document, page_id: (u32, u16), page_index: usize, page_height: f64) -> Vec<WasmBlock> {
    let bytes = match doc.get_and_decode_page_content(page_id) {
        Ok(b) => b,
        Err(_) => return vec![],
    };
    let content = match Content::decode(&bytes) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let mut blocks: Vec<WasmBlock> = Vec::new();
    let mut idx = 0usize;

    // Text object state
    let mut in_bt = false;
    let mut cur_text = String::new();
    let mut start_x = 0.0_f64;
    let mut start_y = 0.0_f64;

    // Text line matrix columns e and f (translation part)
    let mut tlm_e = 0.0_f64;
    let mut tlm_f = 0.0_f64;

    let mut font_name = String::from("Helvetica");
    let mut font_size = 11.0_f64;
    let mut leading = 0.0_f64;

    // Flush cur_text as a block. Called via macro to borrow start_x/y by value.
    macro_rules! flush {
        () => {
            if let Some(b) = make_block(&cur_text, start_x, start_y, font_size, &font_name, page_index, page_height, idx) {
                blocks.push(b);
                idx += 1;
            }
            cur_text.clear();
        };
    }

    macro_rules! set_pos {
        ($ex:expr, $fy:expr) => {
            tlm_e = $ex;
            tlm_f = $fy;
            if cur_text.is_empty() {
                start_x = tlm_e;
                start_y = tlm_f;
            }
        };
    }

    for op in &content.operations {
        match op.operator.as_str() {
            "BT" => {
                in_bt = true;
                cur_text.clear();
                tlm_e = 0.0; tlm_f = 0.0;
                start_x = 0.0; start_y = 0.0;
            }
            "ET" => {
                if in_bt { flush!(); }
                in_bt = false;
            }
            "Tf" if in_bt => {
                if op.operands.len() >= 2 {
                    if let Object::Name(n) = &op.operands[0] {
                        font_name = String::from_utf8_lossy(n).to_string();
                    }
                    let sz = obj_f64(&op.operands[1]);
                    if sz > 0.0 { font_size = sz; }
                }
            }
            "TL" if in_bt => {
                if let Some(o) = op.operands.first() {
                    leading = obj_f64(o).abs();
                }
            }
            // Td: translate text line matrix
            "Td" | "TD" if in_bt => {
                if op.operands.len() >= 2 {
                    let tx = obj_f64(&op.operands[0]);
                    let ty = obj_f64(&op.operands[1]);
                    if op.operator == "TD" { leading = -ty; }
                    // Flush on vertical move (new line)
                    if ty.abs() > 0.5 { flush!(); }
                    set_pos!(tlm_e + tx, tlm_f + ty);
                }
            }
            // Tm: set text/line matrix
            "Tm" if in_bt => {
                if op.operands.len() >= 6 {
                    let new_f = obj_f64(&op.operands[5]);
                    if (new_f - tlm_f).abs() > 0.5 { flush!(); }
                    let new_e = obj_f64(&op.operands[4]);
                    set_pos!(new_e, new_f);
                }
            }
            // T*: move to next line
            "T*" if in_bt => {
                flush!();
                set_pos!(tlm_e, tlm_f - leading);
            }
            // Tj: show string
            "Tj" if in_bt => {
                if let Some(Object::String(b, _)) = op.operands.first() {
                    if cur_text.is_empty() { start_x = tlm_e; start_y = tlm_f; }
                    cur_text.push_str(&decode_pdf_string(b));
                }
            }
            // TJ: show array of strings and kerning values
            "TJ" if in_bt => {
                if let Some(Object::Array(items)) = op.operands.first() {
                    if cur_text.is_empty() { start_x = tlm_e; start_y = tlm_f; }
                    for item in items {
                        match item {
                            Object::String(b, _) => cur_text.push_str(&decode_pdf_string(b)),
                            // Large negative kern = word space
                            Object::Integer(n) if *n < -100 => cur_text.push(' '),
                            Object::Real(f)    if *f < -100.0 => cur_text.push(' '),
                            _ => {}
                        }
                    }
                }
            }
            // ': move to next line and show string
            "'" if in_bt => {
                flush!();
                set_pos!(tlm_e, tlm_f - leading);
                if let Some(Object::String(b, _)) = op.operands.first() {
                    cur_text.push_str(&decode_pdf_string(b));
                }
            }
            // ": set spacing, move to next line, show string
            "\"" if in_bt => {
                if op.operands.len() >= 3 {
                    flush!();
                    set_pos!(tlm_e, tlm_f - leading);
                    if let Object::String(b, _) = &op.operands[2] {
                        cur_text.push_str(&decode_pdf_string(b));
                    }
                }
            }
            _ => {}
        }
    }

    // Infer heading levels from relative font sizes
    if !blocks.is_empty() {
        let avg = blocks.iter().map(|b| b.font_meta.size).sum::<f64>() / blocks.len() as f64;
        for b in &mut blocks {
            b.block_type = infer_type(b.font_meta.size, avg).to_string();
        }
    }

    blocks
}

// ── Public export ─────────────────────────────────────────────────────────────

/// Parse a PDF byte slice and return a DocumentModel-compatible JSON value.
/// Runs entirely in the browser — no network, no server.
#[wasm_bindgen]
pub fn parse_pdf(data: &[u8]) -> Result<JsValue, JsValue> {
    let doc = Document::load_mem(data)
        .map_err(|e| JsValue::from_str(&format!("PDF parse error: {e}")))?;

    let pages = doc.get_pages();
    let mut all_blocks: Vec<WasmBlock> = Vec::new();
    let mut page_dimensions: Vec<WasmPageDimension> = Vec::new();

    for (page_num, &page_id) in &pages {
        let page_index = (*page_num as usize).saturating_sub(1);
        let (width, height) = get_page_size(&doc, page_id);
        page_dimensions.push(WasmPageDimension { page_index, width, height });
        all_blocks.extend(parse_page(&doc, page_id, page_index, height));
    }

    page_dimensions.sort_by_key(|p| p.page_index);

    serde_wasm_bindgen::to_value(&ParseResult { blocks: all_blocks, page_dimensions })
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
}
