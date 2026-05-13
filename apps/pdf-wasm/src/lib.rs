use std::collections::HashMap;
use lopdf::{Document, Object, ObjectId};
use base64::Engine;
use serde::Serialize;
use wasm_bindgen::prelude::*;

// ── Init ──────────────────────────────────────────────────────────────────

#[wasm_bindgen(start)]
pub fn init_hooks() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ── Types ─────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct FontMeta {
    family: String,
    size: f64,
    is_bold: bool,
    is_italic: bool,
    color: String,
}

#[derive(Serialize, Clone)]
struct RichSpan {
    text: String,
    bold: bool,
    italic: bool,
    underline: bool,
    strikethrough: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    font_family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    font_size: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    link_href: Option<String>,
    mark: bool,
}

#[derive(Serialize, Clone)]
struct WasmBlock {
    id: String,
    object_id: String,
    source_ref: String,
    #[serde(rename = "type")]
    block_type: String,
    content: String,
    rich_spans: Vec<RichSpan>,
    #[serde(skip_serializing_if = "Option::is_none")]
    next_block_id: Option<String>,
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

// ── Page resource helpers ─────────────────────────────────────────────────

struct PageFontInfo {
    unicode_map: HashMap<u16, char>,
    widths: Vec<f64>,
    first_char: i64,
    default_width: f64,
}

fn resolve_object<'a>(doc: &'a Document, obj: &'a Object) -> Option<&'a Object> {
    match obj {
        Object::Reference(id) => doc.get_object(*id).ok(),
        other => Some(other),
    }
}

fn get_dict<'a>(doc: &'a Document, obj: &'a Object) -> Option<&'a lopdf::Dictionary> {
    let resolved = resolve_object(doc, obj)?;
    resolved.as_dict().ok()
}

fn parse_cmap(data: &[u8]) -> HashMap<u16, char> {
    let s = String::from_utf8_lossy(data);
    let mut map = HashMap::new();
    let mut in_bfchar = false;
    let mut in_bfrange = false;

    for line in s.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("beginbfchar") {
            in_bfchar = true;
            in_bfrange = false;
            continue;
        }
        if trimmed.starts_with("endbfchar") { in_bfchar = false; continue; }
        if trimmed.starts_with("beginbfrange") {
            in_bfrange = true;
            in_bfchar = false;
            continue;
        }
        if trimmed.starts_with("endbfrange") { in_bfrange = false; continue; }

        if in_bfchar {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 2 {
                let code = u16::from_str_radix(parts[0].trim_start_matches('<').trim_end_matches('>'), 16).unwrap_or(0);
                let ch = parse_cmap_char(parts[1]);
                if ch != '\0' { map.insert(code, ch); }
            }
        }
        if in_bfrange {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 3 {
                let lo = u16::from_str_radix(parts[0].trim_start_matches('<').trim_end_matches('>'), 16).unwrap_or(0);
                let hi = u16::from_str_radix(parts[1].trim_start_matches('<').trim_end_matches('>'), 16).unwrap_or(0);
                let dst = parts[2];
                for (i, c) in (lo..=hi).enumerate() {
                    let ch = if dst.starts_with('<') {
                        parse_cmap_char(dst)
                    } else {
                        match dst.parse::<u16>() {
                            Ok(base) => char::from_u32(base as u32 + i as u32).unwrap_or('\u{FFFD}'),
                            Err(_) => '\u{FFFD}',
                        }
                    };
                    if ch != '\0' { map.insert(c, ch); }
                }
            }
        }
    }
    map
}

fn parse_cmap_char(s: &str) -> char {
    let hex = s.trim_start_matches('<').trim_end_matches('>');
    if hex.len() <= 4 {
        let code = u32::from_str_radix(hex, 16).unwrap_or(0);
        char::from_u32(code).unwrap_or('\u{FFFD}')
    } else {
        // Multi-byte Unicode (e.g., <006500730073> = "ess")
        let chars: String = (0..hex.len())
            .step_by(4)
            .filter_map(|i| {
                if i + 4 <= hex.len() {
                    u32::from_str_radix(&hex[i..i+4], 16).ok().and_then(char::from_u32)
                } else { None }
            })
            .collect();
        chars.chars().next().unwrap_or('\u{FFFD}')
    }
}

fn load_font_info(doc: &Document, page_id: ObjectId, font_name: &str) -> Option<PageFontInfo> {
    let page_obj = doc.get_object(page_id).ok()?;
    let page_dict = page_obj.as_dict().ok()?;

    let res_obj = page_dict.get(b"Resources").ok()?;
    let resources = get_dict(doc, res_obj)?;
    let font_obj = resources.get(b"Font").ok()?;
    let fonts_dict = get_dict(doc, font_obj)?;

    let font_ref = fonts_dict.get(font_name.as_bytes()).ok()?;
    let font_dict = get_dict(doc, font_ref)?;

    // ToUnicode CMap
    let unicode_map = if let Ok(tu) = font_dict.get(b"ToUnicode") {
        match resolve_object(doc, tu) {
            Some(Object::Stream(stream)) => parse_cmap(&stream.content),
            _ => HashMap::new(),
        }
    } else {
        HashMap::new()
    };

    // Widths
    let mut widths = Vec::new();
    let mut first_char: i64 = 32;
    let mut default_width = 500.0;

    if let Ok(descriptor_ref) = font_dict.get(b"FontDescriptor") {
        if let Some(desc_dict) = get_dict(doc, descriptor_ref) {
            if let Ok(mw) = desc_dict.get(b"MissingWidth") {
                if let Some(obj) = resolve_object(doc, mw) {
                    default_width = obj_f64(obj);
                }
            }
        }
    }

    if let Ok(fc) = font_dict.get(b"FirstChar") {
        first_char = match resolve_object(doc, fc) {
            Some(Object::Integer(n)) => *n as i64,
            _ => 32,
        };
    }

    if let Ok(w) = font_dict.get(b"Widths") {
        if let Some(arr) = resolve_object(doc, w).and_then(|o| o.as_array().ok()) {
            widths = arr.iter().map(obj_f64).collect();
        }
    }

    Some(PageFontInfo { unicode_map, widths, first_char, default_width })
}


fn decode_with_map(bytes: &[u8], unicode_map: &HashMap<u16, char>) -> String {
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        let words: Vec<u16> = bytes[2..].chunks(2)
            .filter(|c| c.len() == 2)
            .map(|c| ((c[0] as u16) << 8) | (c[1] as u16))
            .collect();
        return String::from_utf16_lossy(&words);
    }

    if !unicode_map.is_empty() {
        return bytes.iter().map(|&b| {
            unicode_map.get(&(b as u16)).copied().unwrap_or_else(|| {
                if b.is_ascii_graphic() || b == b' ' { b as char } else { '\u{FFFD}' }
            })
        }).collect();
    }

    let s = std::str::from_utf8(bytes);
    s.map(|s| s.to_string()).unwrap_or_else(|_| bytes.iter().map(|&b| b as char).collect())
}

fn text_width(text: &str, info: &Option<PageFontInfo>, font_size: f64) -> f64 {
    match info {
        Some(fi) if !fi.widths.is_empty() => {
            text.bytes()
                .map(|b| {
                    let idx = (b as i64 - fi.first_char).max(0) as usize;
                    fi.widths.get(idx).copied().unwrap_or(fi.default_width)
                })
                .sum::<f64>() * font_size / 1000.0
        }
        _ => (text.len() as f64 * font_size * 0.5).max(20.0),
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────

fn obj_f64(obj: &Object) -> f64 {
    match obj {
        Object::Real(f) => *f as f64,
        Object::Integer(i) => *i as f64,
        _ => 0.0,
    }
}

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

fn build_rich_spans(segments: &[(String, String, f64)], base_family: &str, base_size: f64, default_color: &str) -> Vec<RichSpan> {
    segments.iter()
        .filter(|(t, _, _)| !t.trim().is_empty())
        .map(|(text, font, size)| {
            let (family, is_bold, is_italic) = parse_font_name(font);
            RichSpan {
                text: text.clone(),
                bold: is_bold,
                italic: is_italic,
                underline: false,
                strikethrough: false,
                color: Some(default_color.to_string()),
                font_family: if family != base_family { Some(family) } else { None },
                font_size: if (*size - base_size).abs() > 0.5 { Some(*size) } else { None },
                link_href: None,
                mark: false,
            }
        })
        .collect()
}

fn make_block(
    text: &str,
    segments: &[(String, String, f64)],
    x: f64,
    y: f64,
    font_size: f64,
    font_name: &str,
    page_index: usize,
    page_height: f64,
    idx: usize,
    color: &str,
    font_info: &Option<PageFontInfo>,
) -> Option<WasmBlock> {
    let t = text.trim();
    if t.is_empty() { return None; }
    let (family, is_bold, is_italic) = parse_font_name(font_name);
    let sy = (page_height - y - font_size).max(0.0);
    let w = text_width(t, font_info, font_size);
    let rich_spans = build_rich_spans(segments, &family, font_size, color);
    Some(WasmBlock {
        id: format!("blk_wasm_{page_index}_{idx}"),
        object_id: format!("pdfobj_{page_index}_{idx}"),
        source_ref: format!("page:{page_index}:content:{idx}"),
        block_type: "paragraph".to_string(),
        content: t.to_string(),
        rich_spans,
        next_block_id: None,
        page_index,
        bounding_box: [x.max(0.0), sy, (x + w).max(x + 10.0), (sy + font_size * 1.2).max(sy + 10.0)],
        font_meta: FontMeta { family, size: font_size, is_bold, is_italic, color: color.to_string() },
        alignment: "left".to_string(),
        confidence_score: 0.8,
        needs_review: false,
        z_index: idx,
        column_index: 0,
        style_overrides: HashMap::new(),
    })
}

fn assign_columns_and_links(blocks: &mut Vec<WasmBlock>, page_width: f64) {
    if blocks.is_empty() { return; }
    let bin_size = 5.0_f64;
    let n_bins = ((page_width / bin_size).ceil() as usize) + 1;
    let mut occupied = vec![false; n_bins];
    for b in blocks.iter() {
        let lo = (b.bounding_box[0] / bin_size).floor() as usize;
        let hi = ((b.bounding_box[2] / bin_size).ceil() as usize).min(n_bins.saturating_sub(1));
        for i in lo..=hi { occupied[i] = true; }
    }
    let lo_limit = ((page_width * 0.10) / bin_size).floor() as usize;
    let hi_limit = ((page_width * 0.90) / bin_size).ceil() as usize;
    let min_gap_bins = ((20.0 / bin_size).ceil() as usize).max(1);
    let mut dividers: Vec<f64> = Vec::new();
    let mut gap_start: Option<usize> = None;
    let scan_hi = hi_limit.min(n_bins.saturating_sub(1));
    for i in lo_limit..=scan_hi {
        if !occupied[i] { if gap_start.is_none() { gap_start = Some(i); } }
        else if let Some(gs) = gap_start.take() { if i - gs >= min_gap_bins { dividers.push((gs + i) as f64 * 0.5 * bin_size); } }
    }
    if let Some(gs) = gap_start { if scan_hi + 1 - gs >= min_gap_bins { dividers.push((gs + scan_hi) as f64 * 0.5 * bin_size); } }
    for b in blocks.iter_mut() {
        let centre_x = (b.bounding_box[0] + b.bounding_box[2]) * 0.5;
        b.column_index = dividers.iter().filter(|&&d| centre_x > d).count();
    }
    blocks.sort_by(|a, b_blk| {
        if a.column_index != b_blk.column_index { return a.column_index.cmp(&b_blk.column_index); }
        a.bounding_box[1].partial_cmp(&b_blk.bounding_box[1]).unwrap_or(std::cmp::Ordering::Equal)
    });
    for i in 0..blocks.len().saturating_sub(1) {
        if blocks[i].column_index == blocks[i + 1].column_index {
            let next_id = blocks[i + 1].id.clone();
            blocks[i].next_block_id = Some(next_id);
        }
    }
}

// ── Page size ─────────────────────────────────────────────────────────────

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
                match doc.get_object(id).ok()? { Object::Array(a) => a.clone(), _ => return None, }
            }
            _ => return None,
        };
        if arr.len() < 4 { return None; }
        let w = obj_f64(&arr[2]) - obj_f64(&arr[0]);
        let h = obj_f64(&arr[3]) - obj_f64(&arr[1]);
        if w > 0.0 && h > 0.0 { Some((w, h)) } else { None }
    })();
    result.unwrap_or(default)
}

// ── Content stream parser ─────────────────────────────────────────────────

fn parse_page(doc: &Document, page_id: (u32, u16), page_index: usize, page_height: f64, page_width: f64) -> Vec<WasmBlock> {
    let content = match doc.get_and_decode_page_content(page_id) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let mut blocks: Vec<WasmBlock> = Vec::new();
    let mut idx = 0usize;

    let mut in_bt = false;
    let mut cur_text = String::new();
    let mut cur_segments: Vec<(String, String, f64)> = Vec::new();
    let mut cur_seg_text = String::new();
    let mut start_x = 0.0_f64;
    let mut start_y = 0.0_f64;
    let mut tlm_e = 0.0_f64;
    let mut tlm_f = 0.0_f64;
    let mut font_name = String::from("Helvetica");
    let mut font_size = 11.0_f64;
    let mut leading = 0.0_f64;
    let mut fill_color = String::from("#111111");
    let mut font_info: Option<PageFontInfo> = None;

    macro_rules! flush_segment {
        () => { if !cur_seg_text.is_empty() { cur_segments.push((cur_seg_text.clone(), font_name.clone(), font_size)); cur_seg_text.clear(); } };
    }

    macro_rules! flush {
        () => {
            flush_segment!();
            if let Some(b) = make_block(&cur_text, &cur_segments, start_x, start_y, font_size, &font_name, page_index, page_height, idx, &fill_color, &font_info) {
                blocks.push(b);
                idx += 1;
            }
            cur_text.clear();
            cur_segments.clear();
        };
    }

    macro_rules! set_pos {
        ($ex:expr, $fy:expr) => {
            tlm_e = $ex; tlm_f = $fy;
            if cur_text.is_empty() { start_x = tlm_e; start_y = tlm_f; }
        };
    }

    fn rgb_to_hex(r: f64, g: f64, b: f64) -> String {
        format!("#{:02X}{:02X}{:02X}", (r.clamp(0.0, 1.0) * 255.0) as u8, (g.clamp(0.0, 1.0) * 255.0) as u8, (b.clamp(0.0, 1.0) * 255.0) as u8)
    }

    fn cmyk_to_rgb(c: f64, m: f64, y: f64, k: f64) -> (f64, f64, f64) {
        let kc = 1.0 - k;
        ((1.0 - c) * kc, (1.0 - m) * kc, (1.0 - y) * kc)
    }

    for op in &content.operations {
        match op.operator.as_str() {
            "BT" => {
                in_bt = true;
                cur_text.clear(); cur_segments.clear(); cur_seg_text.clear();
                tlm_e = 0.0; tlm_f = 0.0; start_x = 0.0; start_y = 0.0;
            }
            "ET" => { if in_bt { flush!(); } in_bt = false; }
            "Tf" if in_bt => {
                if op.operands.len() >= 2 {
                    flush_segment!();
                    if let Object::Name(n) = &op.operands[0] {
                        font_name = String::from_utf8_lossy(n).to_string();
                        font_info = load_font_info(doc, page_id, &font_name);
                    }
                    let sz = obj_f64(&op.operands[1]);
                    if sz > 0.0 { font_size = sz; }
                }
            }
            "TL" if in_bt => { if let Some(o) = op.operands.first() { leading = obj_f64(o).abs(); } }
            "Td" | "TD" if in_bt => {
                if op.operands.len() >= 2 {
                    let tx = obj_f64(&op.operands[0]);
                    let ty = obj_f64(&op.operands[1]);
                    if op.operator == "TD" { leading = -ty; }
                    if ty.abs() > 0.5 { flush!(); }
                    set_pos!(tlm_e + tx, tlm_f + ty);
                }
            }
            "Tm" if in_bt => {
                if op.operands.len() >= 6 {
                    let new_f = obj_f64(&op.operands[5]);
                    if (new_f - tlm_f).abs() > 0.5 { flush!(); }
                    set_pos!(obj_f64(&op.operands[4]), new_f);
                }
            }
            "T*" if in_bt => { flush!(); set_pos!(tlm_e, tlm_f - leading); }
            "Tj" if in_bt => {
                if let Some(Object::String(b, _)) = op.operands.first() {
                    let empty = std::collections::HashMap::new();
                    let decoded = decode_with_map(b, font_info.as_ref().map_or(&empty, |f| &f.unicode_map));
                    if cur_text.is_empty() { start_x = tlm_e; start_y = tlm_f; }
                    cur_text.push_str(&decoded);
                    cur_seg_text.push_str(&decoded);
                }
            }
            "TJ" if in_bt => {
                if let Some(Object::Array(items)) = op.operands.first() {
                    if cur_text.is_empty() { start_x = tlm_e; start_y = tlm_f; }
                    for item in items {
                        match item {
                            Object::String(b, _) => {
                                let empty = std::collections::HashMap::new();
                                let decoded = decode_with_map(b, font_info.as_ref().map_or(&empty, |f| &f.unicode_map));
                                cur_text.push_str(&decoded);
                                cur_seg_text.push_str(&decoded);
                            }
                            Object::Integer(n) if *n < -100 => { cur_text.push(' '); cur_seg_text.push(' '); }
                            Object::Real(f) if *f < -100.0 => { cur_text.push(' '); cur_seg_text.push(' '); }
                            _ => {}
                        }
                    }
                }
            }
            "'" if in_bt => {
                flush!();
                set_pos!(tlm_e, tlm_f - leading);
                if let Some(Object::String(b, _)) = op.operands.first() {
                    let empty = std::collections::HashMap::new();
                    let decoded = decode_with_map(b, font_info.as_ref().map_or(&empty, |f| &f.unicode_map));
                    cur_text.push_str(&decoded);
                    cur_seg_text.push_str(&decoded);
                }
            }
            "\"" if in_bt => {
                if op.operands.len() >= 3 {
                    flush!();
                    set_pos!(tlm_e, tlm_f - leading);
                    if let Object::String(b, _) = &op.operands[2] {
                        let empty = std::collections::HashMap::new();
                        let decoded = decode_with_map(b, font_info.as_ref().map_or(&empty, |f| &f.unicode_map));
                        cur_text.push_str(&decoded);
                        cur_seg_text.push_str(&decoded);
                    }
                }
            }
            // Color operators (tracked even outside BT)
            "rg" | "RG" => {
                if op.operands.len() >= 3 {
                    fill_color = rgb_to_hex(obj_f64(&op.operands[0]), obj_f64(&op.operands[1]), obj_f64(&op.operands[2]));
                }
            }
            "g" | "G" => {
                if let Some(o) = op.operands.first() {
                    let v = obj_f64(o);
                    fill_color = rgb_to_hex(v, v, v);
                }
            }
            "k" | "K" => {
                if op.operands.len() >= 4 {
                    let (r, g, b) = cmyk_to_rgb(obj_f64(&op.operands[0]), obj_f64(&op.operands[1]), obj_f64(&op.operands[2]), obj_f64(&op.operands[3]));
                    fill_color = rgb_to_hex(r, g, b);
                }
            }
            "scn" | "SCN" => {
                if op.operands.len() >= 3 {
                    fill_color = rgb_to_hex(obj_f64(&op.operands[0]), obj_f64(&op.operands[1]), obj_f64(&op.operands[2]));
                }
            }
            _ => {}
        }
    }

    if !blocks.is_empty() {
        let avg = blocks.iter().map(|b| b.font_meta.size).sum::<f64>() / blocks.len() as f64;
        for b in &mut blocks { b.block_type = infer_type(b.font_meta.size, avg).to_string(); }
    }

    assign_columns_and_links(&mut blocks, page_width);
    blocks
}

// ── Public export ─────────────────────────────────────────────────────────

#[derive(Serialize)]
struct PreflightResult {
    page_count: usize,
    page_dimensions: Vec<WasmPageDimension>,
}

#[wasm_bindgen]
pub fn preflight_pdf(data: &[u8]) -> Result<JsValue, JsValue> {
    let doc = Document::load_mem(data).map_err(|e| JsValue::from_str(&format!("PDF load error: {e}")))?;
    let pages = doc.get_pages();
    let mut dims: Vec<WasmPageDimension> = Vec::new();
    for (page_num, &page_id) in &pages {
        let page_index = (*page_num as usize).saturating_sub(1);
        let (width, height) = get_page_size(&doc, page_id);
        dims.push(WasmPageDimension { page_index, width, height });
    }
    dims.sort_by_key(|p| p.page_index);
    serde_wasm_bindgen::to_value(&PreflightResult { page_count: dims.len(), page_dimensions: dims })
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
}

// ── PdfDocument: stateful object graph API ────────────────────────────────

#[wasm_bindgen]
pub struct PdfDocument {
    doc: lopdf::Document,
}


fn dict_entries(dict: &lopdf::Dictionary) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for (k, v) in dict.iter() {
        let key = String::from_utf8_lossy(k).to_string();
        map.insert(key, object_to_json_value(v));
    }
    serde_json::Value::Object(map)
}

fn object_to_json_value(obj: &lopdf::Object) -> serde_json::Value {
    match obj {
        lopdf::Object::Null => serde_json::Value::Null,
        lopdf::Object::Boolean(b) => serde_json::json!({"type":"bool","value":b}),
        lopdf::Object::Integer(n) => serde_json::json!({"type":"integer","value":n}),
        lopdf::Object::Real(f) => serde_json::json!({"type":"real","value":f}),
        lopdf::Object::Name(n) => serde_json::json!({"type":"name","value":String::from_utf8_lossy(n)}),
        lopdf::Object::String(bytes, _) => serde_json::json!({"type":"string","value":String::from_utf8_lossy(bytes)}),
        lopdf::Object::Array(items) => {
            let arr: Vec<serde_json::Value> = items.iter().map(object_to_json_value).collect();
            serde_json::json!({"type":"array","items":arr})
        }
        lopdf::Object::Dictionary(d) => serde_json::json!({"type":"dict","entries":dict_entries(d)}),
        lopdf::Object::Stream(stream) => {
            let stream_map = serde_json::json!({
                "dict": dict_entries(&stream.dict),
                "decoded": BASE64_STANDARD.encode(&stream.content),
            });
            serde_json::json!({"type":"stream","stream":stream_map})
        }
        lopdf::Object::Reference((n, g)) => serde_json::json!({"type":"ref","obj":n,"gen":g}),
    }
}

fn json_value_to_object(val: &serde_json::Value) -> Result<lopdf::Object, String> {
    let obj_type = val.get("type").and_then(|t| t.as_str()).unwrap_or("");
    match obj_type {
        "null" => Ok(lopdf::Object::Null),
        "bool" => Ok(lopdf::Object::Boolean(val.get("value").and_then(|v| v.as_bool()).unwrap_or(false))),
        "integer" => Ok(lopdf::Object::Integer(val.get("value").and_then(|v| v.as_i64()).unwrap_or(0))),
        "real" => Ok(lopdf::Object::Real(val.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32)),
        "name" => {
            let s = val.get("value").and_then(|v| v.as_str()).unwrap_or("");
            Ok(lopdf::Object::Name(s.as_bytes().to_vec()))
        }
        "string" => {
            let s = val.get("value").and_then(|v| v.as_str()).unwrap_or("");
            Ok(lopdf::Object::String(s.as_bytes().to_vec(), lopdf::StringFormat::Literal))
        }
        "array" => {
            let items = val.get("items").and_then(|v| v.as_array()).ok_or("array missing items")?;
            let mut objs = Vec::new();
            for item in items {
                objs.push(json_value_to_object(item)?);
            }
            Ok(lopdf::Object::Array(objs))
        }
        "dict" => {
            let entries = val.get("entries").and_then(|v| v.as_object()).ok_or("dict missing entries")?;
            let mut dict = lopdf::Dictionary::new();
            for (k, v) in entries {
                dict.set(k.as_bytes().to_vec(), json_value_to_object(v)?);
            }
            Ok(lopdf::Object::Dictionary(dict))
        }
        "ref" => {
            let obj = val.get("obj").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let gen = val.get("gen").and_then(|v| v.as_u64()).unwrap_or(0) as u16;
            Ok(lopdf::Object::Reference((obj, gen)))
        }
        "stream" => {
            let stream_val = val.get("stream").ok_or("stream missing stream field")?;
            let dict_val = stream_val.get("dict").ok_or("stream missing dict")?;
            let dict_obj = json_value_to_object(dict_val)?;
            let dict = dict_obj.as_dict().map_err(|_| "stream dict is not a dict")?.clone();
            let decoded = stream_val.get("decoded").and_then(|v| v.as_str()).unwrap_or("");
            let content = BASE64_STANDARD.decode(decoded).map_err(|e| format!("base64: {e}"))?;
            Ok(lopdf::Object::Stream(lopdf::Stream::new(dict, content)))
        }
        _ => Err(format!("unknown object type: {obj_type}")),
    }
}

lazy_static::lazy_static! {
    static ref BASE64_STANDARD: base64::engine::GeneralPurpose =
        base64::engine::GeneralPurpose::new(&base64::alphabet::STANDARD, base64::engine::general_purpose::NO_PAD);
}

#[wasm_bindgen]
impl PdfDocument {
    #[wasm_bindgen(constructor)]
    pub fn load(data: &[u8]) -> Result<PdfDocument, JsValue> {
        let doc = lopdf::Document::load_mem(data)
            .map_err(|e| JsValue::from_str(&format!("PDF load error: {e}")))?;
        Ok(PdfDocument { doc })
    }

    pub fn page_count(&self) -> usize {
        self.doc.get_pages().len()
    }

    pub fn page_size(&self, page_num: u32) -> Result<JsValue, JsValue> {
        let pages = self.doc.get_pages();
        let page_id = *pages.get(&page_num).ok_or_else(|| JsValue::from_str("page not found"))?;
        let (w, h) = get_page_size(&self.doc, page_id);
        serde_wasm_bindgen::to_value(&serde_json::json!({"width":w,"height":h}))
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn get_object(&self, obj_num: u32, gen_num: u16) -> Result<JsValue, JsValue> {
        let obj = self.doc.get_object((obj_num, gen_num))
            .map_err(|e| JsValue::from_str(&format!("get_object failed: {e}")))?;
        let json = object_to_json_value(obj);
        serde_wasm_bindgen::to_value(&json)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn set_object(&mut self, obj_num: u32, gen_num: u16, value: JsValue) -> Result<(), JsValue> {
        let json: serde_json::Value = serde_wasm_bindgen::from_value(value)
            .map_err(|e| JsValue::from_str(&format!("invalid JSON: {e}")))?;
        let obj = json_value_to_object(&json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.doc.objects.insert((obj_num, gen_num), obj);
        Ok(())
    }

    pub fn add_object(&mut self, value: JsValue) -> Result<u32, JsValue> {
        let json: serde_json::Value = serde_wasm_bindgen::from_value(value)
            .map_err(|e| JsValue::from_str(&format!("invalid JSON: {e}")))?;
        let obj = json_value_to_object(&json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let id = self.doc.add_object(obj);
        Ok(id.0)
    }

    pub fn serialize(&mut self) -> Result<Vec<u8>, JsValue> {
        let mut buf = Vec::new();
        self.doc.save_to(&mut buf)
            .map_err(|e| JsValue::from_str(&format!("serialize failed: {e}")))?;
        Ok(buf)
    }

    // ── Phase 3: Annotations ───────────────────────────────────────────────

    pub fn get_annotations(&self, page_num: u32) -> Result<JsValue, JsValue> {
        let pages = self.doc.get_pages();
        let page_id = *pages.get(&page_num).ok_or_else(|| JsValue::from_str("page not found"))?;
        let page_obj = self.doc.get_object(page_id)
            .map_err(|_| JsValue::from_str("cannot get page object"))?;
        let page_dict = page_obj.as_dict()
            .map_err(|_| JsValue::from_str("page not a dict"))?;
        let annots = match page_dict.get(b"Annots") {
            Ok(obj) => match obj {
                lopdf::Object::Array(arr) => arr.clone(),
                lopdf::Object::Reference(id) => {
                    let resolved = self.doc.get_object(*id)
                        .map_err(|_| JsValue::from_str("cannot resolve annots ref"))?;
                    resolved.as_array().map_err(|_| JsValue::from_str("annots not array"))?.clone()
                }
                _ => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
            },
            Err(_) => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let mut results = Vec::new();
        for annot_ref in &annots {
            if let lopdf::Object::Reference(id) = annot_ref {
                if let Ok(annot_obj) = self.doc.get_object(*id) {
                    results.push(object_to_json_value(annot_obj));
                }
            }
        }
        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn add_annotation(&mut self, page_num: u32, annotation: JsValue) -> Result<u32, JsValue> {
        let json: serde_json::Value = serde_wasm_bindgen::from_value(annotation)
            .map_err(|e| JsValue::from_str(&format!("invalid JSON: {e}")))?;
        let obj = json_value_to_object(&json)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let id = self.doc.add_object(obj);

        let pages = self.doc.get_pages();
        let page_id = *pages.get(&page_num).ok_or_else(|| JsValue::from_str("page not found"))?;
        if let Ok(page_obj) = self.doc.get_object_mut(page_id) {
            if let Ok(dict) = page_obj.as_dict_mut() {
                let mut annots = dict.get(b"Annots")
                    .map(|o| match o {
                        lopdf::Object::Array(a) => a.clone(),
                        lopdf::Object::Reference(r) => {
                            self.doc.get_object(*r).ok()
                                .and_then(|o| o.as_array().ok().cloned())
                                .unwrap_or_default()
                        }
                        _ => vec![],
                    })
                    .unwrap_or_default();
                annots.push(lopdf::Object::Reference((id.0, 0)));
                dict.set("Annots".as_bytes().to_vec(), lopdf::Object::Array(annots));
            }
        }
        Ok(id.0)
    }

    pub fn remove_annotation(&mut self, page_num: u32, annot_obj_num: u32) -> Result<(), JsValue> {
        let pages = self.doc.get_pages();
        let page_id = *pages.get(&page_num).ok_or_else(|| JsValue::from_str("page not found"))?;
        if let Ok(page_obj) = self.doc.get_object_mut(page_id) {
            if let Ok(dict) = page_obj.as_dict_mut() {
                if let Ok(annots) = dict.get(b"Annots") {
                    let arr = match annots {
                        lopdf::Object::Array(a) => a.clone(),
                        lopdf::Object::Reference(r) => {
                            self.doc.get_object(*r).ok()
                                .and_then(|o| o.as_array().ok().cloned())
                                .unwrap_or_default()
                        }
                        _ => vec![],
                    };
                    let filtered: Vec<_> = arr.into_iter()
                        .filter(|o| !matches!(o, lopdf::Object::Reference((n, _)) if *n == annot_obj_num))
                        .collect();
                    dict.set("Annots".as_bytes().to_vec(), lopdf::Object::Array(filtered));
                }
            }
        }
        self.doc.objects.remove(&(annot_obj_num, 0));
        Ok(())
    }

    // ── Phase 3: Metadata ──────────────────────────────────────────────────

    pub fn get_metadata(&self) -> Result<JsValue, JsValue> {
        let info = self.doc.trailer.get(b"Info").ok();
        let result = match info {
            Some(lopdf::Object::Reference(id)) => {
                self.doc.get_object(*id).ok()
                    .and_then(|o| o.as_dict().ok())
                    .map(|d| dict_entries(d))
                    .unwrap_or(serde_json::Value::Null)
            }
            Some(lopdf::Object::Dictionary(d)) => dict_entries(d),
            _ => serde_json::Value::Null,
        };
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn set_metadata(&mut self, meta: JsValue) -> Result<(), JsValue> {
        let json: serde_json::Value = serde_wasm_bindgen::from_value(meta)
            .map_err(|e| JsValue::from_str(&format!("invalid JSON: {e}")))?;
        let mut dict = lopdf::Dictionary::new();
        if let Some(obj) = json.as_object() {
            for (k, v) in obj {
                let obj = json_value_to_object(v)?;
                dict.set(k.as_bytes().to_vec(), obj);
            }
        }
        let info_obj = lopdf::Object::Dictionary(dict);
        let id = self.doc.add_object(info_obj);
        self.doc.trailer.set("Info".as_bytes().to_vec(), lopdf::Object::Reference((id.0, 0)));
        Ok(())
    }

    // ── Phase 4: Form fields ───────────────────────────────────────────────

    pub fn get_form_fields(&self) -> Result<JsValue, JsValue> {
        let catalog_id = match self.doc.catalog() {
            Ok(id) => id,
            Err(_) => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let catalog = match self.doc.get_object(catalog_id) {
            Ok(o) => o,
            Err(_) => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let acroform = match catalog.as_dict().ok().and_then(|d| d.get(b"AcroForm").ok()) {
            Some(lopdf::Object::Reference(id)) => self.doc.get_object(*id).ok(),
            Some(other) => Some(other),
            None => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let fields_array = match acroform.and_then(|o| o.as_dict().ok()) {
            Some(d) => d.get(b"Fields").ok(),
            None => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let fields: Vec<lopdf::Object> = match fields_array {
            Some(lopdf::Object::Array(a)) => a.clone(),
            _ => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let mut results = Vec::new();
        for field_ref in &fields {
            if let lopdf::Object::Reference(id) = field_ref {
                if let Ok(field_obj) = self.doc.get_object(*id) {
                    results.push(object_to_json_value(field_obj));
                }
            }
        }
        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn set_field_value(&mut self, field_obj_num: u32, value: &str) -> Result<(), JsValue> {
        if let Ok(field) = self.doc.get_object_mut((field_obj_num, 0)) {
            if let Ok(dict) = field.as_dict_mut() {
                dict.set("V".as_bytes().to_vec(), lopdf::Object::string_literal(value));
                // Set NeedAppearances in AcroForm so viewer regenerates appearance
                if let Some(lopdf::Object::Reference(cat_ref)) = self.doc.trailer.get(b"Root").ok() {
                    if let Ok(catalog) = self.doc.get_object_mut(*cat_ref) {
                        if let Ok(cat_dict) = catalog.as_dict_mut() {
                            if let Some(af_ref) = cat_dict.get(b"AcroForm").ok().cloned() {
                                let af_id = match af_ref {
                                    lopdf::Object::Reference(id) => id,
                                    _ => return Ok(()),
                                };
                                if let Ok(af) = self.doc.get_object_mut(af_id) {
                                    if let Ok(af_dict) = af.as_dict_mut() {
                                        af_dict.set("NeedAppearances".as_bytes().to_vec(), lopdf::Object::Boolean(true));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }

    pub fn flatten_form(&mut self) -> Result<(), JsValue> {
        // Remove AcroForm from catalog
        if let Some(lopdf::Object::Reference(cat_ref)) = self.doc.trailer.get(b"Root").ok() {
            if let Ok(catalog) = self.doc.get_object_mut(*cat_ref) {
                if let Ok(dict) = catalog.as_dict_mut() {
                    dict.remove(b"AcroForm");
                }
            }
        }
        Ok(())
    }

    // ── Phase 5: Page operations ───────────────────────────────────────────

    pub fn delete_page(&mut self, page_num: u32) -> Result<(), JsValue> {
        self.doc.delete_pages(&[page_num]);
        Ok(())
    }

    pub fn insert_blank_page(&mut self, after_page: u32, width: f64, height: f64) -> Result<(), JsValue> {
        // Create minimal page dictionary
        let mut page_dict = lopdf::Dictionary::new();
        page_dict.set("Type".as_bytes().to_vec(), lopdf::Object::Name(b"Page".to_vec()));
        page_dict.set("MediaBox".as_bytes().to_vec(), lopdf::Object::Array(vec![
            lopdf::Object::Integer(0),
            lopdf::Object::Integer(0),
            lopdf::Object::Real(width as f32),
            lopdf::Object::Real(height as f32),
        ]));
        page_dict.set("Contents".as_bytes().to_vec(), lopdf::Object::Stream(lopdf::Stream::new(lopdf::Dictionary::new(), vec![])));
        let page_obj = lopdf::Object::Dictionary(page_dict);
        let page_ref = lopdf::Object::Reference(self.doc.add_object(page_obj));

        // Insert into page tree
        let pages = self.doc.get_pages();
        let total: u32 = pages.len() as u32;
        let after = after_page.min(total);
        let mut page_ids: Vec<_> = pages.into_iter().collect();
        page_ids.sort_by_key(|(k, _)| *k);
        if after < total {
            page_ids.insert(after as usize, (after + 1, (self.doc.objects.len() as u32, 0)));
        } else {
            page_ids.push((total + 1, (self.doc.objects.len() as u32, 0)));
        }
        // Rebuild page tree
        let kids: Vec<_> = page_ids.iter().map(|(_, id)| lopdf::Object::Reference(*id)).collect();
        if let Ok(0) = self.doc.catalog().map(|id| id.0) {
            // Could not find catalog
        }
        if let Some(lopdf::Object::Reference(cat_ref)) = self.doc.trailer.get(b"Root").ok() {
            if let Ok(catalog) = self.doc.get_object_mut(*cat_ref) {
                if let Ok(dict) = catalog.as_dict_mut() {
                    let old_pages_ref = dict.get(b"Pages").ok().cloned();
                    if let Some(lopdf::Object::Reference(pages_id)) = old_pages_ref {
                        if let Ok(pages_obj) = self.doc.get_object_mut(pages_id) {
                            if let Ok(p_dict) = pages_obj.as_dict_mut() {
                                p_dict.set("Kids".as_bytes().to_vec(), lopdf::Object::Array(kids));
                                p_dict.set("Count".as_bytes().to_vec(), lopdf::Object::Integer(total as i64 + 1));
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }

    pub fn reorder_pages(&mut self, new_order: Box<[u32]>) -> Result<(), JsValue> {
        let pages = self.doc.get_pages();
        let mut page_map: Vec<_> = pages.into_iter().collect();
        page_map.sort_by_key(|(k, _)| *k);

        let reordered: Vec<_> = new_order.iter()
            .filter_map(|n| page_map.iter().find(|(k, _)| k == n).map(|(_, id)| *id))
            .collect();
        if reordered.is_empty() {
            return Err(JsValue::from_str("no valid page numbers"));
        }

        let kids: Vec<_> = reordered.iter().map(|id| lopdf::Object::Reference(*id)).collect();
        if let Some(lopdf::Object::Reference(cat_ref)) = self.doc.trailer.get(b"Root").ok() {
            if let Ok(catalog) = self.doc.get_object_mut(*cat_ref) {
                if let Ok(dict) = catalog.as_dict_mut() {
                    let old_ref = dict.get(b"Pages").ok().cloned();
                    if let Some(lopdf::Object::Reference(pages_id)) = old_ref {
                        if let Ok(pages_obj) = self.doc.get_object_mut(pages_id) {
                            if let Ok(p_dict) = pages_obj.as_dict_mut() {
                                p_dict.set("Kids".as_bytes().to_vec(), lopdf::Object::Array(kids));
                                p_dict.set("Count".as_bytes().to_vec(), lopdf::Object::Integer(reordered.len() as i64));
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }

    pub fn rotate_page(&mut self, page_num: u32, degrees: i32) -> Result<(), JsValue> {
        let pages = self.doc.get_pages();
        let page_id = *pages.get(&page_num).ok_or_else(|| JsValue::from_str("page not found"))?;
        if let Ok(page_obj) = self.doc.get_object_mut(page_id) {
            if let Ok(dict) = page_obj.as_dict_mut() {
                let current = dict.get(b"Rotate")
                    .map(|o| match o { lopdf::Object::Integer(n) => *n, _ => 0 })
                    .unwrap_or(0);
                dict.set("Rotate".as_bytes().to_vec(), lopdf::Object::Integer(current + degrees as i64));
            }
        }
        Ok(())
    }

    pub fn get_images(&self, page_num: u32) -> Result<JsValue, JsValue> {
        let pages = self.doc.get_pages();
        let page_id = *pages.get(&page_num).ok_or_else(|| JsValue::from_str("page not found"))?;
        let page_obj = self.doc.get_object(page_id)
            .map_err(|_| JsValue::from_str("cannot get page"))?;
        let dict = page_obj.as_dict()
            .map_err(|_| JsValue::from_str("page not a dict"))?;

        let resources = match dict.get(b"Resources").ok() {
            Some(lopdf::Object::Reference(id)) => self.doc.get_object(*id).ok(),
            Some(other) => Some(other),
            None => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let xobjects = match resources.and_then(|o| o.as_dict().ok()) {
            Some(d) => d.get(b"XObject").ok(),
            None => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let xobj_dict = match xobjects {
            Some(lopdf::Object::Dictionary(d)) => d,
            Some(lopdf::Object::Reference(id)) => {
                match self.doc.get_object(*id).ok().and_then(|o| o.as_dict().ok()) {
                    Some(d) => d,
                    None => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
                }
            }
            _ => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let mut results = Vec::new();
        for (k, v) in xobj_dict.iter() {
            let obj = match v {
                lopdf::Object::Reference(id) => self.doc.get_object(*id).ok(),
                other => Some(other),
            };
            if let Some(lopdf::Object::Stream(stream)) = obj {
                if stream.dict.get(b"Subtype").ok().map_or(false, |o| matches!(o, lopdf::Object::Name(n) if n == b"Image")) {
                    results.push(serde_json::json!({
                        "name": String::from_utf8_lossy(k),
                        "width": stream.dict.get(b"Width").ok().and_then(|o| obj_f64(o).into()),
                        "height": stream.dict.get(b"Height").ok().and_then(|o| obj_f64(o).into()),
                        "data": BASE64_STANDARD.encode(&stream.content),
                    }));
                }
            }
        }
        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    // ── Phase 6: Incremental save ──────────────────────────────────────────

    pub fn serialize_incremental(&mut self, _original: &[u8]) -> Result<Vec<u8>, JsValue> {
        // Full serialization for now; incremental save can be optimized later
        let mut buf = Vec::new();
        self.doc.save_to(&mut buf)
            .map_err(|e| JsValue::from_str(&format!("save failed: {e}")))?;
        Ok(buf)
    }
}

#[wasm_bindgen]
pub fn parse_pdf(data: &[u8]) -> Result<JsValue, JsValue> {
    let doc = Document::load_mem(data).map_err(|e| JsValue::from_str(&format!("PDF parse error: {e}")))?;
    let pages = doc.get_pages();
    let mut all_blocks: Vec<WasmBlock> = Vec::new();
    let mut page_dimensions: Vec<WasmPageDimension> = Vec::new();
    for (page_num, &page_id) in &pages {
        let page_index = (*page_num as usize).saturating_sub(1);
        let (width, height) = get_page_size(&doc, page_id);
        page_dimensions.push(WasmPageDimension { page_index, width, height });
        all_blocks.extend(parse_page(&doc, page_id, page_index, height, width));
    }
    page_dimensions.sort_by_key(|p| p.page_index);
    serde_wasm_bindgen::to_value(&ParseResult { blocks: all_blocks, page_dimensions })
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
}
