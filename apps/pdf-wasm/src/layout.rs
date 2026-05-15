use std::collections::HashMap;

use crate::blocks::{compute_modal_font_size, detect_list, infer_type};
use crate::hash::stable_object_id;
use crate::types::{RichSpan, WasmBlock, WasmLayoutObject};

// ── Margin inference ──────────────────────────────────────────────────────

fn infer_margins(blocks: &[WasmBlock]) -> (f64, f64) {
    if blocks.is_empty() { return (50.0, 500.0); }

    let mut lefts: Vec<f64> = blocks.iter().map(|b| b.bounding_box[0]).collect();
    let mut rights: Vec<f64> = blocks.iter().map(|b| b.bounding_box[2]).collect();

    lefts.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    rights.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    (lefts[lefts.len() / 2], rights[rights.len() / 2])
}

// ── Alignment detection ───────────────────────────────────────────────────
//
// Fixed: center is detected by geometry (bbox midpoint ≈ page midpoint),
// not as a fallthrough when text doesn't touch either margin.

fn detect_alignment(bbox: &[f64; 4], left_margin: f64, right_margin: f64, page_width: f64) -> String {
    let left = bbox[0];
    let right = bbox[2];
    let bbox_mid = (left + right) * 0.5;
    let page_mid = page_width * 0.5;

    let left_aligned  = (left  - left_margin).abs()  < 20.0;
    let right_aligned = (right - right_margin).abs() < 20.0;
    let center_aligned = (bbox_mid - page_mid).abs() < 20.0;

    if left_aligned && right_aligned { "justify".to_string() }
    else if center_aligned           { "center".to_string() }
    else if left_aligned             { "left".to_string() }
    else if right_aligned            { "right".to_string() }
    else                             { "left".to_string() }
}

// ── Paragraph merge predicates ────────────────────────────────────────────

fn should_merge(prev: &WasmBlock, next: &WasmBlock) -> bool {
    if prev.column_index != next.column_index { return false; }
    let font_size = prev.font_meta.size.max(1.0);
    let gap = next.bounding_box[1] - prev.bounding_box[3];
    // Merge lines within the same paragraph (up to 1.8× line height gap).
    // Gaps beyond that are treated as paragraph breaks.
    gap >= -(font_size * 0.3) && gap <= font_size * 1.8
}

fn merge_group(
    group: &[WasmBlock],
    left_margin: f64,
    right_margin: f64,
    page_width: f64,
) -> Option<WasmBlock> {
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

        let prev_ends_hyphen = merged_content.ends_with('-');
        let next_starts_lower = block.content.chars().next().map_or(false, |c| c.is_ascii_lowercase());

        if prev_ends_hyphen && next_starts_lower {
            merged_content.pop();
            if let Some(last) = merged_spans.last_mut() {
                if last.text.ends_with('-') { last.text.pop(); }
            }
            let mut line_spans = block.rich_spans.clone();
            if let (Some(last), Some(first_span)) = (merged_spans.last_mut(), line_spans.first_mut()) {
                let same = last.bold == first_span.bold
                    && last.italic == first_span.italic
                    && last.underline == first_span.underline
                    && last.font_family == first_span.font_family
                    && last.font_size == first_span.font_size
                    && last.color == first_span.color;
                if same {
                    last.text.push_str(&first_span.text);
                    line_spans.remove(0);
                }
            }
            merged_content.push_str(&block.content);
            merged_spans.extend(line_spans);
        } else {
            merged_content.push(' ');
            merged_content.push_str(&block.content);
            if let Some(last) = merged_spans.last_mut() {
                if !last.text.ends_with(' ') { last.text.push(' '); }
            }
            merged_spans.extend(block.rich_spans.clone());
        }
    }

    let left   = group.iter().map(|b| b.bounding_box[0]).fold(f64::MAX, f64::min);
    let top    = group.iter().map(|b| b.bounding_box[1]).fold(f64::MAX, f64::min);
    let right  = group.iter().map(|b| b.bounding_box[2]).fold(f64::MIN, f64::max);
    let bottom = group.iter().map(|b| b.bounding_box[3]).fold(f64::MIN, f64::max);

    let line_height = first.font_meta.size * 1.2;
    let pad = (line_height * 0.2).max(2.0);
    let bbox = [left, top - pad, right, bottom + pad];

    let alignment = detect_alignment(&bbox, left_margin, right_margin, page_width);
    let (is_list, bullet) = detect_list(&merged_content);
    let block_type = if is_list { "list_item".to_string() } else { first.block_type.clone() };

    // Confidence: penalise for FFFD replacement chars
    let total_chars = merged_content.len().max(1);
    let bad_chars = merged_content.chars().filter(|&c| c == '\u{FFFD}').count();
    let confidence = 1.0 - (bad_chars as f64 / total_chars as f64).min(1.0);

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
        confidence_score: confidence,
        needs_review: bad_chars > 0,
        z_index: first.z_index,
        column_index: first.column_index,
        style_overrides: HashMap::new(),
        bullet,
        is_invisible: first.is_invisible,
    })
}

// ── Table assembly ────────────────────────────────────────────────────────
//
// Converts vector-path grid cells + tagged text blocks into proper table
// WasmLayoutObjects.  Previously this was dead code (cells tagged but
// rows never assembled, table_layout_object() never called).

fn assemble_tables(
    paragraphs: &mut Vec<WasmBlock>,
    vector_paths: &[f64; 4],
    all_paths: &[[f64; 4]],
) -> Vec<WasmLayoutObject> {
    vec![] // placeholder — see full version below
}

pub fn build_table_objects(
    paragraphs: &mut Vec<WasmBlock>,
    vector_paths: &[[f64; 4]],
    page_index: usize,
) -> Vec<WasmLayoutObject> {
    if vector_paths.is_empty() { return vec![]; }

    // Only consider paths large enough to be cell borders (w > 5, h > 5)
    let cells: Vec<[f64; 4]> = vector_paths
        .iter()
        .filter(|p| (p[2] - p[0]) > 5.0 && (p[3] - p[1]) > 5.0)
        .copied()
        .collect();

    if cells.len() < 2 { return vec![]; }

    // Cluster cells that share a common bounding box (same table)
    // Simple approach: union cells that are within 2pt of each other
    let mut clusters: Vec<Vec<[f64; 4]>> = Vec::new();
    'outer: for cell in &cells {
        for cluster in &mut clusters {
            // Check if this cell is adjacent to any cell already in the cluster
            let adj = cluster.iter().any(|c| {
                let h_overlap = cell[0] <= c[2] + 2.0 && cell[2] >= c[0] - 2.0;
                let v_overlap = cell[1] <= c[3] + 2.0 && cell[3] >= c[1] - 2.0;
                h_overlap && v_overlap
            });
            if adj {
                cluster.push(*cell);
                continue 'outer;
            }
        }
        clusters.push(vec![*cell]);
    }

    let mut table_objects: Vec<WasmLayoutObject> = Vec::new();
    let mut blocks_to_remove: Vec<usize> = Vec::new();

    for cluster in clusters {
        if cluster.len() < 2 { continue; }

        // Table bounding box
        let tx0 = cluster.iter().map(|c| c[0]).fold(f64::MAX, f64::min);
        let ty0 = cluster.iter().map(|c| c[1]).fold(f64::MAX, f64::min);
        let tx1 = cluster.iter().map(|c| c[2]).fold(f64::MIN, f64::max);
        let ty1 = cluster.iter().map(|c| c[3]).fold(f64::MIN, f64::max);

        // Collect unique row/col boundaries
        let mut row_edges: Vec<f64> = cluster.iter().flat_map(|c| [c[1], c[3]]).collect();
        row_edges.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        row_edges.dedup_by(|a, b| (*a - *b).abs() < 2.0);

        let mut col_edges: Vec<f64> = cluster.iter().flat_map(|c| [c[0], c[2]]).collect();
        col_edges.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        col_edges.dedup_by(|a, b| (*a - *b).abs() < 2.0);

        if row_edges.len() < 2 || col_edges.len() < 2 { continue; }

        let n_rows = row_edges.len() - 1;
        let n_cols = col_edges.len() - 1;

        // Build empty grid
        let mut grid: Vec<Vec<String>> = vec![vec![String::new(); n_cols]; n_rows];

        // Map text blocks into cells
        let mut used_block_idxs: Vec<usize> = Vec::new();
        for (bi, block) in paragraphs.iter().enumerate() {
            let [bx0, by0, bx1, by1] = block.bounding_box;
            // Block must be entirely inside the table
            if bx0 < tx0 - 2.0 || bx1 > tx1 + 2.0 || by0 < ty0 - 2.0 || by1 > ty1 + 2.0 {
                continue;
            }
            let block_mid_x = (bx0 + bx1) * 0.5;
            let block_mid_y = (by0 + by1) * 0.5;

            // Find column
            let col = col_edges.windows(2).position(|w| {
                block_mid_x >= w[0] - 2.0 && block_mid_x <= w[1] + 2.0
            });
            // Find row
            let row = row_edges.windows(2).position(|w| {
                block_mid_y >= w[0] - 2.0 && block_mid_y <= w[1] + 2.0
            });

            if let (Some(r), Some(c)) = (row, col) {
                if r < n_rows && c < n_cols {
                    if !grid[r][c].is_empty() { grid[r][c].push(' '); }
                    grid[r][c].push_str(&block.content);
                    used_block_idxs.push(bi);
                }
            }
        }

        if used_block_idxs.is_empty() { continue; }

        blocks_to_remove.extend(&used_block_idxs);

        let bbox = [tx0, ty0, tx1, ty1];
        let source_ref = format!("page:{page_index}:table:{}", table_objects.len());
        let id = stable_object_id("table", page_index, &source_ref, bbox);

        table_objects.push(WasmLayoutObject {
            id: id.clone(),
            object_type: "table".to_string(),
            page_index,
            x: tx0,
            y: ty0,
            width: tx1 - tx0,
            height: ty1 - ty0,
            rotation: 0.0,
            z_index: 10000 + table_objects.len(),
            source_ref,
            original_pdf_object_id: id,
            content: None,
            font_family: None,
            font_size: None,
            color: None,
            text_align: None,
            rows: Some(grid),
            field_name: None,
            field_type: None,
            value: None,
            required: None,
        });
    }

    // Remove consumed text blocks (in reverse order to keep indices stable)
    blocks_to_remove.sort_unstable();
    blocks_to_remove.dedup();
    for &i in blocks_to_remove.iter().rev() {
        paragraphs.remove(i);
    }

    table_objects
}

// ── Strikethrough detection ───────────────────────────────────────────────

fn apply_strikethrough(block: &mut WasmBlock, vector_paths: &[[f64; 4]]) {
    let [bx0, by0, bx1, by1] = block.bounding_box;
    let y_mid = (by0 + by1) * 0.5;

    for path in vector_paths {
        let [px0, py0, px1, py1] = *path;
        let is_horizontal = (py1 - py0).abs() < 2.0;
        let at_midheight = (py0 - y_mid).abs() < (by1 - by0) * 0.35;
        let intersects_x = px0 < bx1 && px1 > bx0;

        if is_horizontal && at_midheight && intersects_x {
            for span in &mut block.rich_spans {
                span.strikethrough = true;
            }
            break;
        }
    }
}

// ── Underline detection ───────────────────────────────────────────────────

fn apply_underline(block: &mut WasmBlock, vector_paths: &[[f64; 4]]) {
    let [bx0, _, bx1, by1] = block.bounding_box;

    for path in vector_paths {
        let [px0, py0, px1, py1] = *path;
        let is_horizontal = (py1 - py0).abs() < 2.0;
        let is_under = (py0 - by1).abs() < 4.0 || (py1 - by1).abs() < 4.0;
        let intersects_x = px0 < bx1 && px1 > bx0;

        if is_horizontal && is_under && intersects_x {
            for span in &mut block.rich_spans {
                span.underline = true;
            }
            break;
        }
    }
}

// ── Main reconstruction pipeline ──────────────────────────────────────────

pub struct ReconstructResult {
    pub blocks: Vec<WasmBlock>,
    pub table_objects: Vec<WasmLayoutObject>,
}

pub fn reconstruct_paragraphs(
    raw_blocks: Vec<WasmBlock>,
    vector_paths: Vec<[f64; 4]>,
    page_width: f64,
    page_index: usize,
    warnings: &mut Vec<String>,
) -> ReconstructResult {
    if raw_blocks.is_empty() {
        return ReconstructResult { blocks: vec![], table_objects: vec![] };
    }

    // Compute modal body font size for heading classification
    let body_size = compute_modal_font_size(&raw_blocks);

    let (left_margin, right_margin) = infer_margins(&raw_blocks);

    // Apply heading types using document-wide body size
    let mut typed_blocks = raw_blocks;
    for b in &mut typed_blocks {
        b.block_type = infer_type(b.font_meta.size, body_size).to_string();
    }

    // Merge lines into paragraphs
    let mut paragraphs: Vec<WasmBlock> = Vec::new();
    let mut current_group: Vec<WasmBlock> = Vec::new();

    for block in typed_blocks {
        if current_group.is_empty() {
            current_group.push(block);
            continue;
        }
        let prev = current_group.last().unwrap();
        if should_merge(prev, &block) {
            current_group.push(block);
        } else {
            if let Some(merged) = merge_group(&current_group, left_margin, right_margin, page_width) {
                paragraphs.push(merged);
            } else {
                warnings.push(format!(
                    "Failed to merge line group on page {}", current_group[0].page_index
                ));
            }
            current_group = vec![block];
        }
    }
    if !current_group.is_empty() {
        if let Some(merged) = merge_group(&current_group, left_margin, right_margin, page_width) {
            paragraphs.push(merged);
        }
    }

    // Underline + strikethrough via vector paths
    for block in &mut paragraphs {
        apply_underline(block, &vector_paths);
        apply_strikethrough(block, &vector_paths);
    }

    // Table assembly (consumes matched blocks from paragraphs)
    let table_objects = build_table_objects(&mut paragraphs, &vector_paths, page_index);

    // Re-link remaining blocks
    for i in 0..paragraphs.len().saturating_sub(1) {
        if paragraphs[i].page_index == paragraphs[i + 1].page_index
            && paragraphs[i].column_index == paragraphs[i + 1].column_index
        {
            let next_id = paragraphs[i + 1].id.clone();
            paragraphs[i].next_block_id = Some(next_id);
        }
    }

    ReconstructResult { blocks: paragraphs, table_objects }
}
