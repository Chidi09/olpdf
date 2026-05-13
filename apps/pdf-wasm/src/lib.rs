use std::collections::HashMap;
use lopdf::{Document, Object, ObjectId};
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

fn object_to_json_value(obj: &lopdf::Object) -> serde_json::Value {
    use lopdf::Object::*;
    match obj {
        Null => serde_json::Value::Null,
        Boolean(b) => serde_json::json!({"type":"bool","value":b}),
        Integer(n) => serde_json::json!({"type":"integer","value":n}),
        Real(f) => serde_json::json!({"type":"real","value":f}),
        Name(n) => serde_json::json!({"type":"name","value":String::from_utf8_lossy(n)}),
        String(bytes, _) => serde_json::json!({"type":"string","value":String::from_utf8_lossy(bytes)}),
        Array(items) => {
            let arr: Vec<serde_json::Value> = items.iter().map(object_to_json_value).collect();
            serde_json::json!({"type":"array","items":arr})
        }
        Dict(d) => {
            let mut map = serde_json::Map::new();
            for (k, v) in &d.0 {
                let key = String::from_utf8_lossy(k).to_string();
                map.insert(key, object_to_json_value(v));
            }
            serde_json::json!({"type":"dict","entries":serde_json::Value::Object(map)})
        }
        Stream(stream) => {
            let mut stream_map = serde_json::Map::new();
            let mut dict_map = serde_json::Map::new();
            for (k, v) in &stream.dict.0 {
                let key = String::from_utf8_lossy(k).to_string();
                dict_map.insert(key, object_to_json_value(v));
            }
            stream_map.insert("dict".to_string(), serde_json::Value::Object(dict_map));
            stream_map.insert("decoded".to_string(), serde_json::Value::String(
                BASE64_STANDARD.encode(&stream.content)
            ));
            serde_json::json!({"type":"stream","stream":serde_json::Value::Object(stream_map)})
        }
        Reference((n, g)) => serde_json::json!({"type":"ref","obj":n,"gen":g}),
    }
}

use lopdf::Object as LObject;

fn json_value_to_object(val: &serde_json::Value) -> Result<lopdf::Object, String> {
    let obj_type = val.get("type").and_then(|t| t.as_str()).unwrap_or("");
    match obj_type {
        "null" => Ok(LObject::Null),
        "bool" => Ok(LObject::Boolean(val.get("value").and_then(|v| v.as_bool()).unwrap_or(false))),
        "integer" => Ok(LObject::Integer(val.get("value").and_then(|v| v.as_i64()).unwrap_or(0) as i32)),
        "real" => Ok(LObject::Real(val.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0))),
        "name" => {
            let s = val.get("value").and_then(|v| v.as_str()).unwrap_or("");
            Ok(LObject::Name(s.as_bytes().to_vec()))
        }
        "string" => {
            let s = val.get("value").and_then(|v| v.as_str()).unwrap_or("");
            Ok(LObject::String(s.as_bytes().to_vec(), lopdf::StringFormat::Literal))
        }
        "array" => {
            let items = val.get("items").and_then(|v| v.as_array()).ok_or("array missing items")?;
            let mut objs = Vec::new();
            for item in items {
                objs.push(json_value_to_object(item)?);
            }
            Ok(LObject::Array(objs))
        }
        "dict" => {
            let entries = val.get("entries").and_then(|v| v.as_object()).ok_or("dict missing entries")?;
            let mut dict = lopdf::Dictionary::new();
            for (k, v) in entries {
                dict.set(k.as_bytes().to_vec(), json_value_to_object(v)?);
            }
            Ok(LObject::Dict(dict))
        }
        "ref" => {
            let obj = val.get("obj").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let gen = val.get("gen").and_then(|v| v.as_u64()).unwrap_or(0) as u16;
            Ok(LObject::Reference((obj, gen)))
        }
        "stream" => {
            let stream_val = val.get("stream").ok_or("stream missing stream field")?;
            let dict_val = stream_val.get("dict").ok_or("stream missing dict")?;
            let dict_obj = json_value_to_object(dict_val)?;
            let dict = dict_obj.as_dict().map_err(|_| "stream dict is not a dict")?.clone();
            let decoded = stream_val.get("decoded").and_then(|v| v.as_str()).unwrap_or("");
            let content = BASE64_STANDARD.decode(decoded).map_err(|e| format!("base64: {e}"))?;
            Ok(LObject::Stream(lopdf::Stream::new(dict, content)))
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
            .map_err(|e| JsValue::from_str(&e))?;
        self.doc.objects.insert((obj_num, gen_num), obj);
        Ok(())
    }

    pub fn add_object(&mut self, value: JsValue) -> Result<u32, JsValue> {
        let json: serde_json::Value = serde_wasm_bindgen::from_value(value)
            .map_err(|e| JsValue::from_str(&format!("invalid JSON: {e}")))?;
        let obj = json_value_to_object(&json)
            .map_err(|e| JsValue::from_str(&e))?;
        let id = self.doc.add_object(obj);
        Ok(id.0)
    }

    pub fn serialize(&self) -> Result<Vec<u8>, JsValue> {
        let mut buf = Vec::new();
        self.doc.save_to(&mut buf)
            .map_err(|e| JsValue::from_str(&format!("serialize failed: {e}")))?;
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
