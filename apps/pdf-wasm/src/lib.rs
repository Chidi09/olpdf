use std::collections::HashMap;
use lopdf::{Document, Object, ObjectId};
use base64::Engine;
use serde::Serialize;
use wasm_bindgen::prelude::*;
use web_sys::window;

#[wasm_bindgen(start)]
pub fn init_hooks() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

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
    #[serde(skip_serializing_if = "String::is_empty")]
    vertical_align: String,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    bullet: Option<String>,
    #[serde(default)]
    is_invisible: bool,
}

#[derive(Clone)]
struct Matrix {
    a: f64, b: f64, c: f64, d: f64, e: f64, f: f64,
}

impl Default for Matrix {
    fn default() -> Self {
        Self { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: 0.0 }
    }
}

impl Matrix {
    fn multiply(&self, other: &Self) -> Self {
        Self {
            a: self.a * other.a + self.b * other.c,
            b: self.a * other.b + self.b * other.d,
            c: self.c * other.a + self.d * other.c,
            d: self.c * other.b + self.d * other.d,
            e: self.e * other.a + self.f * other.c + other.e,
            f: self.e * other.b + self.f * other.d + other.f,
        }
    }
    fn transform(&self, x: f64, y: f64) -> (f64, f64) {
        (x * self.a + y * self.c + self.e, x * self.b + y * self.d + self.f)
    }
}

#[derive(Clone)]
struct GraphicsState {
    ctm: Matrix,
    font_name: String,
    font_size: f64,
    fill_color: String,
    stroke_color: String,
    leading: f64,
    render_mode: i64,
}

impl Default for GraphicsState {
    fn default() -> Self {
        Self {
            ctm: Matrix::default(),
            font_name: "Helvetica".to_string(),
            font_size: 11.0,
            fill_color: "#111111".to_string(),
            stroke_color: "#111111".to_string(),
            leading: 0.0,
            render_mode: 0,
        }
    }
}

#[derive(Serialize)]
struct WasmPageDimension {
    page_index: usize,
    width: f64,
    height: f64,
}

#[derive(Serialize)]
struct ParseMetrics {
    duration_ms: f64,
    total_blocks: usize,
    unmapped_chars: usize,
    pages_failed: usize,
    warnings: Vec<String>,
    image_count: usize,
    missing_fonts_count: usize,
    is_likely_scanned: bool,
}

#[derive(Serialize)]
struct ParseResult {
    blocks: Vec<WasmBlock>,
    page_dimensions: Vec<WasmPageDimension>,
    metrics: ParseMetrics,
}

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

fn load_font_info(doc: &Document, page_id: ObjectId, font_name: &str, warnings: &mut Vec<String>, missing_fonts_count: &mut usize) -> Option<PageFontInfo> {
    let page_obj = doc.get_object(page_id).ok()?;
    let page_dict = page_obj.as_dict().ok()?;

    let res_obj = page_dict.get(b"Resources").ok()?;
    let resources = get_dict(doc, res_obj)?;
    let font_obj = resources.get(b"Font").ok()?;
    let fonts_dict = get_dict(doc, font_obj)?;

    let font_ref = fonts_dict.get(font_name.as_bytes()).ok();
    let font_dict = match font_ref.and_then(|r| get_dict(doc, r)) {
        Some(d) => d,
        None => {
            *missing_fonts_count += 1;
            return None;
        }
    };

    let unicode_map = if let Ok(tu) = font_dict.get(b"ToUnicode") {
        match resolve_object(doc, tu) {
            Some(Object::Stream(stream)) => parse_cmap(&stream.content),
            _ => {
                warnings.push(format!("Failed to resolve ToUnicode CMap for font '{}'", font_name));
                HashMap::new()
            }
        }
    } else {
        warnings.push(format!("No ToUnicode CMap for font '{}'", font_name));
        HashMap::new()
    };

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
            let lower_font = font.to_lowercase();
            let vert_align = if base_size > 0.0 && *size < base_size * 0.65 {
                if lower_font.contains("sub") { "sub".to_string() } else { "super".to_string() }
            } else {
                String::new()
            };
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
                vertical_align: vert_align,
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
        bullet: None,
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

fn parse_page(
    doc: &Document,
    page_id: (u32, u16),
    page_index: usize,
    page_height: f64,
    page_width: f64,
    warnings: &mut Vec<String>,
    unmapped_chars: &mut usize,
    vector_paths: &mut Vec<[f64; 4]>,
    image_count: &mut usize,
    missing_fonts_count: &mut usize,
) -> Vec<WasmBlock> {
    let content = match doc.get_and_decode_page_content(page_id) {
        Ok(c) => c,
        Err(e) => {
            warnings.push(format!("Failed to decode page {} content stream: {}", page_index, e));
            return vec![];
        }
    };

    let mut blocks: Vec<WasmBlock> = Vec::new();
    let mut idx = 0usize;

    // Graphics State Stack
    let mut stack: Vec<GraphicsState> = vec![GraphicsState::default()];
    let mut in_bt = false;
    let mut cur_text = String::new();
    let mut cur_segments: Vec<(String, String, f64)> = Vec::new();
    let mut cur_seg_text = String::new();

    // Text Matrices
    let mut tm = Matrix::default();
    let mut tlm = Matrix::default();
    let mut font_info: Option<PageFontInfo> = None;

    // Path tracking state
    let mut current_path: Vec<(f64, f64)> = Vec::new();

    // Marked Content state (Artifacts)
    let mut artifact_depth = 0usize;

    macro_rules! state {
        () => { stack.last_mut().unwrap() };
    }

    macro_rules! flush_segment {
        () => {
            if !cur_seg_text.is_empty() {
                cur_segments.push((cur_seg_text.clone(), state!().font_name.clone(), state!().font_size));
                cur_seg_text.clear();
            }
        };
    }

    macro_rules! flush {
        () => {
            flush_segment!();
            if !cur_text.is_empty() {
                let (x, y) = state!().ctm.transform(tm.e, tm.f);
                let font_name = state!().font_name.clone();
                let font_size = state!().font_size;
                let fill_color = state!().fill_color.clone();
                let is_invisible = state!().render_mode == 3;

                // Only emit block if not inside an Artifact
                if artifact_depth == 0 {
                    if let Some(mut b) = make_block(
                        &cur_text, &cur_segments, x, y, font_size, &font_name,
                        page_index, page_height, idx, &fill_color, &font_info
                    ) {
                        b.is_invisible = is_invisible;
                        blocks.push(b);
                        idx += 1;
                    }
                }
                cur_text.clear();
                cur_segments.clear();
            }
        };
    }

    fn rgb_to_hex(r: f64, g: f64, b: f64) -> String {
        format!("#{:02X}{:02X}{:02X}", (r.clamp(0.0, 1.0) * 255.0) as u8, (g.clamp(0.0, 1.0) * 255.0) as u8, (b.clamp(0.0, 1.0) * 255.0) as u8)
    }

    fn cmyk_to_rgb(c: f64, m: f64, y: f64, k: f64) -> (f64, f64, f64) {
        let kc = 1.0 - k;
        ((1.0 - c) * kc, (1.0 - m) * kc, (1.0 - y) * kc)
    }

    let count_unmapped = |s: &str| s.chars().filter(|&c| c == '\u{FFFD}').count();

    for op in &content.operations {
        match op.operator.as_str() {
            "q" => { stack.push(state!().clone()); }
            "Q" => { if stack.len() > 1 { stack.pop(); } }
            "cm" => {
                if op.operands.len() >= 6 {
                    let m = Matrix {
                        a: obj_f64(&op.operands[0]),
                        b: obj_f64(&op.operands[1]),
                        c: obj_f64(&op.operands[2]),
                        d: obj_f64(&op.operands[3]),
                        e: obj_f64(&op.operands[4]),
                        f: obj_f64(&op.operands[5]),
                    };
                    state!().ctm = m.multiply(&state!().ctm);
                }
            }
            "BT" => {
                in_bt = true;
                tm = Matrix::default();
                tlm = Matrix::default();
                cur_text.clear(); cur_segments.clear(); cur_seg_text.clear();
            }
            "ET" => { if in_bt { flush!(); } in_bt = false; }
            "Tf" => {
                if op.operands.len() >= 2 {
                    if in_bt { flush_segment!(); }
                    if let Object::Name(n) = &op.operands[0] {
                        state!().font_name = String::from_utf8_lossy(n).to_string();
                        font_info = load_font_info(doc, page_id, &state!().font_name, warnings, missing_fonts_count);
                    }
                    let sz = obj_f64(&op.operands[1]);
                    if sz > 0.0 { state!().font_size = sz; }
                }
            }
            "Tr" => {
                if let Some(Object::Integer(n)) = op.operands.first() {
                    state!().render_mode = *n;
                }
            }
            "TL" => { if let Some(o) = op.operands.first() { state!().leading = obj_f64(o).abs(); } }
            "Td" | "TD" => {
                if op.operands.len() >= 2 {
                    let tx = obj_f64(&op.operands[0]);
                    let ty = obj_f64(&op.operands[1]);
                    if op.operator == "TD" { state!().leading = -ty; }
                    if ty.abs() > 0.5 && in_bt { flush!(); }
                    let m = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: tx, f: ty };
                    tlm = m.multiply(&tlm);
                    tm = tlm.clone();
                }
            }
            "Tm" => {
                if op.operands.len() >= 6 {
                    let m = Matrix {
                        a: obj_f64(&op.operands[0]),
                        b: obj_f64(&op.operands[1]),
                        c: obj_f64(&op.operands[2]),
                        d: obj_f64(&op.operands[3]),
                        e: obj_f64(&op.operands[4]),
                        f: obj_f64(&op.operands[5]),
                    };
                    if (m.f - tm.f).abs() > 0.5 && in_bt { flush!(); }
                    tm = m.clone();
                    tlm = m.clone();
                }
            }
            "T*" => {
                if in_bt { flush!(); }
                let m = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: -state!().leading };
                tlm = m.multiply(&tlm);
                tm = tlm.clone();
            }
            "Tj" | "'" | "\"" => {
                let bytes = match op.operator.as_str() {
                    "Tj" => op.operands.first().and_then(|o| o.as_str().ok()),
                    "'" => {
                        if in_bt { flush!(); }
                        let m = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: -state!().leading };
                        tlm = m.multiply(&tlm);
                        tm = tlm.clone();
                        op.operands.first().and_then(|o| o.as_str().ok())
                    }
                    "\"" => {
                        if op.operands.len() >= 3 {
                            if in_bt { flush!(); }
                            state!().leading = obj_f64(&op.operands[1]).abs();
                            let m = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: -state!().leading };
                            tlm = m.multiply(&tlm);
                            tm = tlm.clone();
                            op.operands[2].as_str().ok()
                        } else { None }
                    }
                    _ => None
                };
                if let Some(b) = bytes {
                    let empty = std::collections::HashMap::new();
                    let decoded = decode_with_map(b, font_info.as_ref().map_or(&empty, |f| &f.unicode_map));
                    *unmapped_chars += count_unmapped(&decoded);
                    cur_text.push_str(&decoded);
                    cur_seg_text.push_str(&decoded);
                }
            }
            "TJ" => {
                if let Some(Object::Array(items)) = op.operands.first() {
                    for item in items {
                        match item {
                            Object::String(b, _) => {
                                let empty = std::collections::HashMap::new();
                                let decoded = decode_with_map(b, font_info.as_ref().map_or(&empty, |f| &f.unicode_map));
                                *unmapped_chars += count_unmapped(&decoded);
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
            // Color operators
            "rg" | "RG" => {
                if op.operands.len() >= 3 {
                    let hex = rgb_to_hex(obj_f64(&op.operands[0]), obj_f64(&op.operands[1]), obj_f64(&op.operands[2]));
                    if op.operator == "rg" { state!().fill_color = hex; } else { state!().stroke_color = hex; }
                }
            }
            "g" | "G" => {
                if let Some(o) = op.operands.first() {
                    let v = obj_f64(o);
                    let hex = rgb_to_hex(v, v, v);
                    if op.operator == "g" { state!().fill_color = hex; } else { state!().stroke_color = hex; }
                }
            }
            "k" | "K" => {
                if op.operands.len() >= 4 {
                    let (r, g, b) = cmyk_to_rgb(obj_f64(&op.operands[0]), obj_f64(&op.operands[1]), obj_f64(&op.operands[2]), obj_f64(&op.operands[3]));
                    let hex = rgb_to_hex(r, g, b);
                    if op.operator == "k" { state!().fill_color = hex; } else { state!().stroke_color = hex; }
                }
            }
            // Path operators (Phase 3)
            "m" => {
                if op.operands.len() >= 2 {
                    let x = obj_f64(&op.operands[0]);
                    let y = obj_f64(&op.operands[1]);
                    current_path.clear();
                    current_path.push(state!().ctm.transform(x, y));
                }
            }
            "l" => {
                if op.operands.len() >= 2 {
                    let x = obj_f64(&op.operands[0]);
                    let y = obj_f64(&op.operands[1]);
                    current_path.push(state!().ctm.transform(x, y));
                }
            }
            "re" => {
                if op.operands.len() >= 4 {
                    let x = obj_f64(&op.operands[0]);
                    let y = obj_f64(&op.operands[1]);
                    let w = obj_f64(&op.operands[2]);
                    let h = obj_f64(&op.operands[3]);
                    let (x0, y0) = state!().ctm.transform(x, y);
                    let (x1, y1) = state!().ctm.transform(x + w, y + h);
                    vector_paths.push([x0.min(x1), y0.min(y1), x0.max(x1), y0.max(y1)]);
                }
            }
            "S" | "f" | "B" | "s" | "F" | "b" => {
                if current_path.len() >= 2 {
                    let x_min = current_path.iter().map(|p| p.0).fold(f64::MAX, f64::min);
                    let x_max = current_path.iter().map(|p| p.0).fold(f64::MIN, f64::max);
                    let y_min = current_path.iter().map(|p| p.1).fold(f64::MAX, f64::min);
                    let y_max = current_path.iter().map(|p| p.1).fold(f64::MIN, f64::max);
                    vector_paths.push([x_min, y_min, x_max, y_max]);
                }
                current_path.clear();
            }
            // Marked Content (Phase 3 Artifact Filtering)
            "BDC" => {
                let is_artifact = op.operands.iter().any(|o| {
                    match o {
                        Object::Name(n) => n == b"Artifact",
                        Object::Dictionary(d) => d.get(b"Type").ok().map_or(false, |v| matches!(v, Object::Name(n) if n == b"Artifact")),
                        _ => false,
                    }
                });
                if is_artifact { artifact_depth += 1; }
            }
            "BMC" => {
                if let Some(Object::Name(n)) = op.operands.first() {
                    if n == b"Artifact" { artifact_depth += 1; }
                }
            }
            "EMC" => {
                if artifact_depth > 0 { artifact_depth -= 1; }
            }
            // Image tracking
            "Do" => {
                *image_count += 1;
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

// ── Paragraph Reconstruction Engine ─────────────────────────────────────

fn infer_margins(blocks: &[WasmBlock]) -> (f64, f64) {
    if blocks.is_empty() {
        return (50.0, 500.0);
    }
    let lefts: Vec<f64> = blocks.iter().map(|b| b.bounding_box[0]).collect();
    let rights: Vec<f64> = blocks.iter().map(|b| b.bounding_box[2]).collect();
    let median = |mut v: Vec<f64>| -> f64 {
        v.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        v[v.len() / 2]
    };
    (median(lefts), median(rights))
}

fn detect_alignment(bbox: &[f64; 4], left_margin: f64, right_margin: f64) -> String {
    let left = bbox[0];
    let right = bbox[2];
    let left_aligned = (left - left_margin).abs() < 20.0;
    let right_aligned = (right - right_margin).abs() < 20.0;

    if left_aligned && right_aligned { "justify".to_string() }
    else if left_aligned { "left".to_string() }
    else if right_aligned { "right".to_string() }
    else { "center".to_string() }
}

fn detect_list(text: &str) -> (bool, Option<String>) {
    let trimmed = text.trim_start();
    if trimmed.is_empty() { return (false, None); }

    let first = trimmed.chars().next().unwrap();
    if first == '•' || first == '*' || first == '▪' || first == '-' {
        let rest: String = trimmed.chars().skip(1).collect();
        if rest.trim_start().starts_with(|c: char| c.is_alphanumeric()) {
            return (true, Some(first.to_string()));
        }
    }

    let digit_end = trimmed.find(|c: char| !c.is_ascii_digit()).unwrap_or(trimmed.len());
    if digit_end > 0 {
        let after_digits = &trimmed[digit_end..];
        if after_digits.starts_with('.') || after_digits.starts_with(')') {
            let rest = after_digits[1..].trim_start();
            if !rest.is_empty() {
                let marker = format!("{}{}", &trimmed[..digit_end], &after_digits[..1]);
                return (true, Some(marker));
            }
        }
    }

    if trimmed.len() >= 2 {
        let chars: Vec<char> = trimmed.chars().collect();
        if chars[0].is_ascii_alphabetic() {
            if chars[1] == '.' || chars[1] == ')' {
                let rest = trimmed[2..].trim_start();
                if !rest.is_empty() {
                    return (true, Some(format!("{}{}", chars[0], chars[1])));
                }
            }
        }
    }

    (false, None)
}

fn should_merge_with_previous(prev: &WasmBlock, next: &WasmBlock) -> bool {
    if prev.column_index != next.column_index { return false; }

    let font_size = prev.font_meta.size.max(1.0);

    let gap = next.bounding_box[1] - prev.bounding_box[3];

    gap >= -(font_size * 0.3) && gap <= font_size * 1.8
}

fn merge_line_group(group: &[WasmBlock], left_margin: f64, right_margin: f64) -> Option<WasmBlock> {
    if group.is_empty() { return None; }
    let first = &group[0];

    let mut merged_content = String::new();
    let mut merged_spans: Vec<RichSpan> = Vec::new();

    for (i, block) in group.iter().enumerate() {
        if i == 0 {
            merged_content.push_str(&block.content);
            merged_spans = block.rich_spans.clone();
            continue;
        }

        let prev_content = merged_content.clone();
        let text = &block.content;

        let prev_ends_hyphen = prev_content.ends_with('-');
        let next_starts_lower = text.chars().next().map_or(false, |c| c.is_ascii_lowercase());

        if prev_ends_hyphen && next_starts_lower {
            merged_content.pop();

            if let Some(last_span) = merged_spans.last_mut() {
                if last_span.text.ends_with('-') {
                    last_span.text.pop();
                }
            }

            let mut line_spans = block.rich_spans.clone();
            if let Some(last_span) = merged_spans.last_mut() {
                if let Some(first_span) = line_spans.first_mut() {
                    let same_style = last_span.bold == first_span.bold
                        && last_span.italic == first_span.italic
                        && last_span.underline == first_span.underline
                        && last_span.strikethrough == first_span.strikethrough
                        && last_span.font_family == first_span.font_family
                        && last_span.font_size == first_span.font_size
                        && last_span.color == first_span.color;
                    if same_style {
                        last_span.text.push_str(&first_span.text);
                        line_spans.remove(0);
                    }
                }
            }

            merged_content.push_str(text);
            merged_spans.extend(line_spans);
        } else {
            merged_content.push(' ');
            merged_content.push_str(text);

            if let Some(last_span) = merged_spans.last_mut() {
                if !last_span.text.ends_with(' ') {
                    last_span.text.push(' ');
                }
            }

            merged_spans.extend(block.rich_spans.clone());
        }
    }

    let left = group.iter().map(|b| b.bounding_box[0]).fold(f64::MAX, |a, b| a.min(b));
    let top = group.iter().map(|b| b.bounding_box[1]).fold(f64::MAX, |a, b| a.min(b));
    let right = group.iter().map(|b| b.bounding_box[2]).fold(f64::MIN, |a, b| a.max(b));
    let bottom = group.iter().map(|b| b.bounding_box[3]).fold(f64::MIN, |a, b| a.max(b));

    let line_height = first.font_meta.size * 1.2;
    let pad = (line_height * 0.2).max(2.0);
    let bbox = [left, top - pad, right, bottom + pad];

    let alignment = detect_alignment(&bbox, left_margin, right_margin);

    let (is_list, bullet) = detect_list(&merged_content);

    let block_type = if is_list {
        "list_item".to_string()
    } else {
        first.block_type.clone()
    };

    Some(WasmBlock {
        id: first.id.clone(),
        object_id: first.object_id.clone(),
        source_ref: first.source_ref.clone(),
        block_type,
        content: merged_content,
        rich_spans: merged_spans,
        next_block_id: None,
        page_index: first.page_index,
        bounding_box: bbox,
        font_meta: first.font_meta.clone(),
        alignment,
        confidence_score: 0.85,
        needs_review: false,
        z_index: first.z_index,
        column_index: first.column_index,
        style_overrides: HashMap::new(),
        bullet,
    })
}

fn reconstruct_paragraphs(
    blocks: Vec<WasmBlock>,
    vector_paths: Vec<[f64; 4]>,
    warnings: &mut Vec<String>
) -> Vec<WasmBlock> {
    if blocks.is_empty() { return vec![]; }

    let (left_margin, right_margin) = infer_margins(&blocks);

    let mut paragraphs: Vec<WasmBlock> = Vec::new();
    let mut current_group: Vec<WasmBlock> = Vec::new();

    for block in blocks {
        if current_group.is_empty() {
            current_group.push(block);
            continue;
        }

        let prev = current_group.last().unwrap();
        if should_merge_with_previous(prev, &block) {
            current_group.push(block);
        } else {
            if let Some(mut merged) = merge_line_group(&current_group, left_margin, right_margin) {
                // Phase 3: Underline detection
                for path in &vector_paths {
                    let [px0, py0, px1, py1] = *path;
                    let [bx0, by0, bx1, by1] = merged.bounding_box;

                    // If path is a thin horizontal line just below the block
                    let is_horizontal = (py1 - py0).abs() < 2.0;
                    let is_under = (py0 - by1).abs() < 3.0 || (py1 - by1).abs() < 3.0;
                    let intersects_x = px0 < bx1 && px1 > bx0;

                    if is_horizontal && is_under && intersects_x {
                        for span in &mut merged.rich_spans {
                            span.underline = true;
                        }
                        break;
                    }
                }
                paragraphs.push(merged);
            } else {
                warnings.push(format!("Failed to merge line group on page {}", current_group[0].page_index));
            }
            current_group = vec![block];
        }
    }

    if !current_group.is_empty() {
        if let Some(mut merged) = merge_line_group(&current_group, left_margin, right_margin) {
            for path in &vector_paths {
                let [px0, py0, px1, py1] = *path;
                let [bx0, by0, bx1, by1] = merged.bounding_box;
                let is_horizontal = (py1 - py0).abs() < 2.0;
                let is_under = (py0 - by1).abs() < 3.0 || (py1 - by1).abs() < 3.0;
                let intersects_x = px0 < bx1 && px1 > bx0;
                if is_horizontal && is_under && intersects_x {
                    for span in &mut merged.rich_spans {
                        span.underline = true;
                    }
                    break;
                }
            }
            paragraphs.push(merged);
        }
    }

    // Phase 3: Table detection
    let mut table_blocks: Vec<WasmBlock> = Vec::new();
    if !vector_paths.is_empty() {
        // Simple heuristic: Group vector rectangles that are adjacent or overlapping
        let mut grid_cells = Vec::new();
        for path in &vector_paths {
            let [x0, y0, x1, y1] = *path;
            let w = x1 - x0;
            let h = y1 - y0;
            if w > 5.0 && h > 5.0 { // Filter out thin lines/artifacts
                grid_cells.push([x0, y0, x1, y1]);
            }
        }

        // Identify table-like structures where cells are aligned
        for (i, cell) in grid_cells.iter().enumerate() {
            let [cx0, cy0, cx1, cy1] = *cell;
            let mut cell_content = Vec::new();

            // Find text blocks contained within this cell
            for (b_idx, block) in paragraphs.iter().enumerate() {
                let [bx0, by0, bx1, by1] = block.bounding_box;
                if bx0 >= cx0 - 2.0 && bx1 <= cx1 + 2.0 && by0 >= cy0 - 2.0 && by1 <= cy1 + 2.0 {
                    cell_content.push(b_idx);
                }
            }

            if !cell_content.is_empty() {
                // If a cell has content, tag it or merge it into a table structure
                // For now, we simply flag these blocks to avoid them being reflowed as standard paragraphs
                for idx in cell_content {
                    paragraphs[idx].style_overrides.insert("in_table".to_string(), i.to_string());
                }
            }
        }
    }

    for i in 0..paragraphs.len().saturating_sub(1) {
        if paragraphs[i].page_index == paragraphs[i + 1].page_index
            && paragraphs[i].column_index == paragraphs[i + 1].column_index
        {
            let next_id = paragraphs[i + 1].id.clone();
            paragraphs[i].next_block_id = Some(next_id);
        }
    }

    paragraphs
}

// ── Public exports ──────────────────────────────────────────────────────

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
        let mut annots: Vec<lopdf::Object> = self.doc.get_object(page_id)
            .ok()
            .and_then(|o| o.as_dict().ok())
            .and_then(|d| d.get(b"Annots").ok())
            .and_then(|o| o.as_array().ok())
            .map(|a| a.clone())
            .unwrap_or_default();
        annots.push(lopdf::Object::Reference((id.0, 0)));

        if let Ok(page_obj) = self.doc.get_object_mut(page_id) {
            if let Ok(dict) = page_obj.as_dict_mut() {
                dict.set("Annots".as_bytes().to_vec(), lopdf::Object::Array(annots));
            }
        }
        Ok(id.0)
    }

    pub fn remove_annotation(&mut self, page_num: u32, annot_obj_num: u32) -> Result<(), JsValue> {
        let pages = self.doc.get_pages();
        let page_id = *pages.get(&page_num).ok_or_else(|| JsValue::from_str("page not found"))?;
        let filtered: Vec<lopdf::Object> = self.doc.get_object(page_id)
            .ok()
            .and_then(|o| o.as_dict().ok())
            .and_then(|d| d.get(b"Annots").ok())
            .and_then(|o| o.as_array().ok())
            .map(|a| {
                a.iter()
                    .filter(|o| !matches!(o, lopdf::Object::Reference((n, _)) if *n == annot_obj_num))
                    .cloned()
                    .collect()
            })
            .unwrap_or_default();

        if let Ok(page_obj) = self.doc.get_object_mut(page_id) {
            if let Ok(dict) = page_obj.as_dict_mut() {
                dict.set("Annots".as_bytes().to_vec(), lopdf::Object::Array(filtered));
            }
        }
        self.doc.objects.remove(&(annot_obj_num, 0));
        Ok(())
    }

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

    pub fn get_form_fields(&self) -> Result<JsValue, JsValue> {
        let catalog = match self.doc.catalog() {
            Ok(c) => c,
            Err(_) => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let acroform = match catalog.get(b"AcroForm").ok() {
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
        if let Some(lopdf::Object::Reference(cat_ref)) = self.doc.trailer.get(b"Root").ok() {
            if let Ok(catalog) = self.doc.get_object_mut(*cat_ref) {
                if let Ok(dict) = catalog.as_dict_mut() {
                    dict.remove(b"AcroForm");
                }
            }
        }
        Ok(())
    }

    pub fn delete_page(&mut self, page_num: u32) -> Result<(), JsValue> {
        self.doc.delete_pages(&[page_num]);
        Ok(())
    }

    pub fn insert_blank_page(&mut self, after_page: u32, width: f64, height: f64) -> Result<(), JsValue> {
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
        let _page_ref = lopdf::Object::Reference(self.doc.add_object(page_obj));

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
        let kids: Vec<_> = page_ids.iter().map(|(_, id)| lopdf::Object::Reference(*id)).collect();
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

    pub fn serialize_incremental(&mut self, _original: &[u8]) -> Result<Vec<u8>, JsValue> {
        let mut buf = Vec::new();
        self.doc.save_to(&mut buf)
            .map_err(|e| JsValue::from_str(&format!("save failed: {e}")))?;
        Ok(buf)
    }
}

#[wasm_bindgen]
pub fn parse_pdf(data: &[u8]) -> Result<JsValue, JsValue> {
    let perf = window()
        .ok_or_else(|| JsValue::from_str("No window"))?
        .performance()
        .ok_or_else(|| JsValue::from_str("No performance"))?;
    let start = perf.now();

    let doc = Document::load_mem(data).map_err(|e| JsValue::from_str(&format!("PDF parse error: {e}")))?;
    let pages = doc.get_pages();
    let mut all_blocks: Vec<WasmBlock> = Vec::new();
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
            &doc, page_id, page_index, height, width,
            &mut warnings, &mut total_unmapped, &mut vector_paths,
            &mut total_image_count, &mut total_missing_fonts
        );

        if page_blocks.is_empty() {
            pages_failed += 1;
        }

        // Phase 2 & 3: Reconstruction
        let reconstructed = reconstruct_paragraphs(page_blocks, vector_paths, &mut warnings);
        all_blocks.extend(reconstructed);
    }

    page_dimensions.sort_by_key(|p| p.page_index);

    let duration_ms = perf.now() - start;
    let total_blocks = all_blocks.len();

    // Simple heuristic: If there are images but very few text blocks, it's likely a scanned document.
    let is_likely_scanned = total_image_count > 0 && total_blocks < 5 && pages.len() > 0;

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

    serde_wasm_bindgen::to_value(&ParseResult { blocks: all_blocks, page_dimensions, metrics })
        .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
}
