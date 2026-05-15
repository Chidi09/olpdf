use std::collections::HashMap;

use crate::font::{parse_font_name, text_width};
use crate::hash::stable_object_id;
use crate::types::{FontMeta, PageFontInfo, RichSpan, WasmBlock};

// ── Rich span builder ─────────────────────────────────────────────────────

pub fn build_rich_spans(
    segments: &[(String, String, f64)],
    base_family: &str,
    base_size: f64,
    default_color: &str,
) -> Vec<RichSpan> {
    segments
        .iter()
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

// ── Block factory ─────────────────────────────────────────────────────────

pub fn make_block(
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
    // Convert from PDF coordinate system (bottom-up) to screen (top-down)
    let sy = (page_height - y - font_size).max(0.0);
    let w = text_width(t, font_info, font_size);
    let rich_spans = build_rich_spans(segments, &family, font_size, color);
    let bbox = [
        x.max(0.0),
        sy,
        (x + w).max(x + 10.0),
        (sy + font_size * 1.2).max(sy + 10.0),
    ];
    let source_ref = format!("page:{page_index}:content:{idx}");

    Some(WasmBlock {
        id: format!("blk_wasm_{page_index}_{idx}"),
        object_id: stable_object_id("text", page_index, &source_ref, bbox),
        source_ref,
        block_type: "paragraph".to_string(),
        content: t.to_string(),
        rich_spans,
        next_block_id: None,
        page_index,
        bounding_box: bbox,
        font_meta: FontMeta {
            family,
            size: font_size,
            is_bold,
            is_italic,
            color: color.to_string(),
        },
        alignment: "left".to_string(),
        confidence_score: 0.8,
        needs_review: false,
        z_index: idx,
        column_index: 0,
        style_overrides: HashMap::new(),
        bullet: None,
        is_invisible: false,
    })
}

// ── Heading type inference ────────────────────────────────────────────────
//
// Uses the modal (most-common) body font size across the document instead of
// the per-page mean, so TOC pages and section pages don't skew the baseline.

pub fn compute_modal_font_size(blocks: &[WasmBlock]) -> f64 {
    if blocks.is_empty() { return 11.0; }

    // Bucket sizes into 0.5pt bins
    let mut buckets: HashMap<i64, usize> = HashMap::new();
    for b in blocks {
        let bucket = (b.font_meta.size * 2.0).round() as i64; // ×2 for 0.5pt resolution
        *buckets.entry(bucket).or_insert(0) += 1;
    }
    let modal_bucket = buckets
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(bucket, _)| bucket)
        .unwrap_or(22); // default 11pt (22 × 0.5)

    (modal_bucket as f64) * 0.5
}

pub fn infer_type(size: f64, body_size: f64) -> &'static str {
    let r = size / body_size.max(1.0);
    if r >= 1.8 { "heading1" }
    else if r >= 1.3 { "heading2" }
    else if r >= 1.1 { "heading3" }
    else { "paragraph" }
}

// ── List detection ────────────────────────────────────────────────────────

pub fn detect_list(text: &str) -> (bool, Option<String>) {
    let trimmed = text.trim_start();
    if trimmed.is_empty() { return (false, None); }

    let first = trimmed.chars().next().unwrap();
    if matches!(first, '•' | '*' | '▪' | '-' | '–' | '◦' | '▸' | '›') {
        let rest: String = trimmed.chars().skip(1).collect();
        if rest.trim_start().starts_with(|c: char| c.is_alphanumeric()) {
            return (true, Some(first.to_string()));
        }
    }

    // Numeric: "1." "1)" "12."
    let digit_end = trimmed.find(|c: char| !c.is_ascii_digit()).unwrap_or(trimmed.len());
    if digit_end > 0 {
        let after = &trimmed[digit_end..];
        if after.starts_with('.') || after.starts_with(')') {
            let rest = after[1..].trim_start();
            if !rest.is_empty() {
                return (true, Some(format!("{}{}", &trimmed[..digit_end], &after[..1])));
            }
        }
    }

    // Alpha: "a." "a)" "A."
    if trimmed.len() >= 2 {
        let chars: Vec<char> = trimmed.chars().collect();
        if chars[0].is_ascii_alphabetic() && (chars[1] == '.' || chars[1] == ')') {
            let rest = trimmed[2..].trim_start();
            if !rest.is_empty() {
                return (true, Some(format!("{}{}", chars[0], chars[1])));
            }
        }
    }

    (false, None)
}

// ── Column assignment ─────────────────────────────────────────────────────

pub fn assign_columns_and_links(blocks: &mut Vec<WasmBlock>, page_width: f64) {
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
        if !occupied[i] {
            if gap_start.is_none() { gap_start = Some(i); }
        } else if let Some(gs) = gap_start.take() {
            if i - gs >= min_gap_bins {
                dividers.push((gs + i) as f64 * 0.5 * bin_size);
            }
        }
    }
    if let Some(gs) = gap_start {
        if scan_hi + 1 - gs >= min_gap_bins {
            dividers.push((gs + scan_hi) as f64 * 0.5 * bin_size);
        }
    }

    for b in blocks.iter_mut() {
        let centre_x = (b.bounding_box[0] + b.bounding_box[2]) * 0.5;
        b.column_index = dividers.iter().filter(|&&d| centre_x > d).count();
    }

    blocks.sort_by(|a, b| {
        if a.column_index != b.column_index {
            return a.column_index.cmp(&b.column_index);
        }
        a.bounding_box[1]
            .partial_cmp(&b.bounding_box[1])
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    for i in 0..blocks.len().saturating_sub(1) {
        if blocks[i].column_index == blocks[i + 1].column_index {
            let next_id = blocks[i + 1].id.clone();
            blocks[i].next_block_id = Some(next_id);
        }
    }
}
