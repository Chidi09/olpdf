use std::collections::HashMap;
use lopdf::{Document, Object, ObjectId, content::Content};

use crate::blocks::{assign_columns_and_links, make_block};
use crate::cmap::decode_bytes;
use crate::font::{get_dict, load_font_info, obj_f64, resolve_object};
use crate::types::{GraphicsState, Matrix, PageFontInfo, WasmBlock};

// ── Color helpers ─────────────────────────────────────────────────────────

fn rgb_to_hex(r: f64, g: f64, b: f64) -> String {
    format!(
        "#{:02X}{:02X}{:02X}",
        (r.clamp(0.0, 1.0) * 255.0) as u8,
        (g.clamp(0.0, 1.0) * 255.0) as u8,
        (b.clamp(0.0, 1.0) * 255.0) as u8,
    )
}

fn cmyk_to_hex(c: f64, m: f64, y: f64, k: f64) -> String {
    let kc = 1.0 - k.clamp(0.0, 1.0);
    rgb_to_hex(
        (1.0 - c.clamp(0.0, 1.0)) * kc,
        (1.0 - m.clamp(0.0, 1.0)) * kc,
        (1.0 - y.clamp(0.0, 1.0)) * kc,
    )
}

// ── Page size ─────────────────────────────────────────────────────────────

pub fn get_page_size(doc: &Document, page_id: (u32, u16)) -> (f64, f64) {
    let default = (595.28_f64, 841.89_f64);
    let result: Option<(f64, f64)> = (|| {
        let obj = doc.get_object(page_id).ok()?;
        let dict = obj.as_dict().ok()?;
        let mb = dict.get(b"MediaBox").ok()?;
        let arr: Vec<Object> = match mb {
            Object::Array(a) => a.clone(),
            Object::Reference(id) => match doc.get_object(*id).ok()? {
                Object::Array(a) => a.clone(),
                _ => return None,
            },
            _ => return None,
        };
        if arr.len() < 4 { return None; }
        let w = obj_f64(&arr[2]) - obj_f64(&arr[0]);
        let h = obj_f64(&arr[3]) - obj_f64(&arr[1]);
        if w > 0.0 && h > 0.0 { Some((w, h)) } else { None }
    })();
    result.unwrap_or(default)
}

// ── Core content-stream interpreter ──────────────────────────────────────

pub struct InterpContext<'a> {
    pub doc: &'a Document,
    pub page_id: ObjectId,
    pub page_index: usize,
    pub page_height: f64,
    pub page_width: f64,
    pub warnings: &'a mut Vec<String>,
    pub unmapped_chars: &'a mut usize,
    pub vector_paths: &'a mut Vec<[f64; 4]>,
    pub image_count: &'a mut usize,
    pub missing_fonts_count: &'a mut usize,
    /// Depth guard against recursive Form XObject loops
    pub xobject_depth: usize,
}

pub fn interpret_content(
    ctx: &mut InterpContext<'_>,
    ops: &[lopdf::content::Operation],
    stack: &mut Vec<GraphicsState>,
    blocks: &mut Vec<WasmBlock>,
    idx: &mut usize,
) {
    let mut in_bt = false;
    let mut cur_text = String::new();
    let mut cur_segments: Vec<(String, String, f64)> = Vec::new();
    let mut cur_seg_text = String::new();

    let mut tm = Matrix::default();
    let mut tlm = Matrix::default();
    let mut font_info: Option<PageFontInfo> = None;
    let mut current_path: Vec<(f64, f64)> = Vec::new();
    let mut artifact_depth = 0usize;

    macro_rules! state {
        () => { stack.last_mut().unwrap() };
    }

    macro_rules! flush_segment {
        () => {
            if !cur_seg_text.is_empty() {
                cur_segments.push((
                    cur_seg_text.clone(),
                    state!().font_name.clone(),
                    state!().font_size,
                ));
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

                if artifact_depth == 0 {
                    if let Some(mut b) = make_block(
                        &cur_text,
                        &cur_segments,
                        x,
                        y,
                        font_size,
                        &font_name,
                        ctx.page_index,
                        ctx.page_height,
                        *idx,
                        &fill_color,
                        &font_info,
                    ) {
                        b.is_invisible = is_invisible;
                        blocks.push(b);
                        *idx += 1;
                    }
                }
                cur_text.clear();
                cur_segments.clear();
            }
        };
    }

    for op in ops {
        match op.operator.as_str() {
            // ── Graphics state ────────────────────────────────────────────
            "q" => {
                let new_state = stack.last().unwrap().clone();
                stack.push(new_state);
            }
            "Q" => {
                if stack.len() > 1 { stack.pop(); }
            }
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

            // ── Text block ────────────────────────────────────────────────
            "BT" => {
                in_bt = true;
                tm = Matrix::default();
                tlm = Matrix::default();
                cur_text.clear();
                cur_segments.clear();
                cur_seg_text.clear();
            }
            "ET" => {
                if in_bt { flush!(); }
                in_bt = false;
            }

            // ── Font / text state ─────────────────────────────────────────
            "Tf" => {
                if op.operands.len() >= 2 {
                    if in_bt { flush_segment!(); }
                    if let Object::Name(n) = &op.operands[0] {
                        state!().font_name = String::from_utf8_lossy(n).to_string();
                        font_info = load_font_info(
                            ctx.doc,
                            ctx.page_id,
                            &state!().font_name.clone(),
                            ctx.warnings,
                            ctx.missing_fonts_count,
                        );
                    }
                    let sz = obj_f64(&op.operands[1]);
                    if sz > 0.0 { state!().font_size = sz; }
                }
            }
            "Tr" => {
                if let Some(o) = op.operands.first() {
                    state!().render_mode = obj_f64(o) as i64;
                }
            }
            "TL" => {
                if let Some(o) = op.operands.first() {
                    state!().leading = obj_f64(o).abs();
                }
            }
            "Tc" => {
                if let Some(o) = op.operands.first() {
                    state!().char_spacing = obj_f64(o);
                }
            }
            "Tw" => {
                if let Some(o) = op.operands.first() {
                    state!().word_spacing = obj_f64(o);
                }
            }
            "Tz" => {
                if let Some(o) = op.operands.first() {
                    // PDF Tz is a percentage (100 = normal); store as factor
                    state!().horiz_scale = obj_f64(o) / 100.0;
                }
            }

            // ── Text positioning ──────────────────────────────────────────
            "Td" | "TD" => {
                if op.operands.len() >= 2 {
                    let tx = obj_f64(&op.operands[0]);
                    let ty = obj_f64(&op.operands[1]);
                    if op.operator == "TD" { state!().leading = (-ty).abs(); }
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
                    tlm = m;
                }
            }
            "T*" => {
                if in_bt { flush!(); }
                let lead = state!().leading;
                let m = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: -lead };
                tlm = m.multiply(&tlm);
                tm = tlm.clone();
            }

            // ── Text show ─────────────────────────────────────────────────
            "Tj" | "'" | "\"" => {
                let bytes_opt = match op.operator.as_str() {
                    "Tj" => op.operands.first().and_then(|o| o.as_str().ok()),
                    "'" => {
                        if in_bt { flush!(); }
                        let lead = state!().leading;
                        let m = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: -lead };
                        tlm = m.multiply(&tlm);
                        tm = tlm.clone();
                        op.operands.first().and_then(|o| o.as_str().ok())
                    }
                    "\"" => {
                        if op.operands.len() >= 3 {
                            if in_bt { flush!(); }
                            state!().leading = obj_f64(&op.operands[1]).abs();
                            let lead = state!().leading;
                            let m = Matrix { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: -lead };
                            tlm = m.multiply(&tlm);
                            tm = tlm.clone();
                            op.operands[2].as_str().ok()
                        } else {
                            None
                        }
                    }
                    _ => None,
                };
                if let Some(b) = bytes_opt {
                    let decoded = decode_with_font(b, &font_info, ctx.unmapped_chars);
                    cur_text.push_str(&decoded);
                    cur_seg_text.push_str(&decoded);
                }
            }
            "TJ" => {
                if let Some(Object::Array(items)) = op.operands.first() {
                    let word_spacing = state!().word_spacing;
                    // Threshold for implicit space: use word_spacing-adjusted value.
                    // PDF spec: kerning in TJ is in 1/1000 text-space units (negative = tighter).
                    // A value < -250 typically represents a word gap.
                    let space_threshold = if word_spacing != 0.0 { -150.0 } else { -100.0 };
                    for item in items {
                        match item {
                            Object::String(b, _) => {
                                let decoded = decode_with_font(b, &font_info, ctx.unmapped_chars);
                                cur_text.push_str(&decoded);
                                cur_seg_text.push_str(&decoded);
                            }
                            Object::Integer(n) if (*n as f64) < space_threshold => {
                                cur_text.push(' ');
                                cur_seg_text.push(' ');
                            }
                            Object::Real(f) if (*f as f64) < space_threshold => {
                                cur_text.push(' ');
                                cur_seg_text.push(' ');
                            }
                            _ => {}
                        }
                    }
                }
            }

            // ── Color ─────────────────────────────────────────────────────
            "rg" | "RG" => {
                if op.operands.len() >= 3 {
                    let hex = rgb_to_hex(
                        obj_f64(&op.operands[0]),
                        obj_f64(&op.operands[1]),
                        obj_f64(&op.operands[2]),
                    );
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
                    let hex = cmyk_to_hex(
                        obj_f64(&op.operands[0]),
                        obj_f64(&op.operands[1]),
                        obj_f64(&op.operands[2]),
                        obj_f64(&op.operands[3]),
                    );
                    if op.operator == "k" { state!().fill_color = hex; } else { state!().stroke_color = hex; }
                }
            }

            // ── Paths ─────────────────────────────────────────────────────
            "m" => {
                if op.operands.len() >= 2 {
                    let (x, y) = state!().ctm.transform(obj_f64(&op.operands[0]), obj_f64(&op.operands[1]));
                    current_path.clear();
                    current_path.push((x, y));
                }
            }
            "l" => {
                if op.operands.len() >= 2 {
                    let (x, y) = state!().ctm.transform(obj_f64(&op.operands[0]), obj_f64(&op.operands[1]));
                    current_path.push((x, y));
                }
            }
            "h" => {
                // closepath: connect back to start (already in path)
                if let Some(&first) = current_path.first() {
                    current_path.push(first);
                }
            }
            "c" => {
                // cubic bezier: 6 operands, control pts + endpoint
                if op.operands.len() >= 6 {
                    let (x3, y3) = state!().ctm.transform(obj_f64(&op.operands[4]), obj_f64(&op.operands[5]));
                    current_path.push((x3, y3));
                }
            }
            "v" | "y" => {
                // bezier variants: 4 operands, endpoint is last pair
                if op.operands.len() >= 4 {
                    let (x2, y2) = state!().ctm.transform(obj_f64(&op.operands[2]), obj_f64(&op.operands[3]));
                    current_path.push((x2, y2));
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
                    ctx.vector_paths.push([x0.min(x1), y0.min(y1), x0.max(x1), y0.max(y1)]);
                }
            }
            "S" | "f" | "B" | "s" | "F" | "b" | "f*" | "B*" => {
                if current_path.len() >= 2 {
                    let x_min = current_path.iter().map(|p| p.0).fold(f64::MAX, f64::min);
                    let x_max = current_path.iter().map(|p| p.0).fold(f64::MIN, f64::max);
                    let y_min = current_path.iter().map(|p| p.1).fold(f64::MAX, f64::min);
                    let y_max = current_path.iter().map(|p| p.1).fold(f64::MIN, f64::max);
                    ctx.vector_paths.push([x_min, y_min, x_max, y_max]);
                }
                current_path.clear();
            }
            "n" => { current_path.clear(); } // end path without painting

            // ── Marked content ────────────────────────────────────────────
            "BDC" => {
                let is_artifact = op.operands.iter().any(|o| match o {
                    Object::Name(n) => n == b"Artifact",
                    Object::Dictionary(d) => d
                        .get(b"Type")
                        .ok()
                        .map_or(false, |v| matches!(v, Object::Name(n) if n == b"Artifact")),
                    _ => false,
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

            // ── XObjects (images + Form XObjects) ─────────────────────────
            "Do" => {
                if let Some(Object::Name(xobj_name)) = op.operands.first() {
                    let name = xobj_name.clone();
                    if ctx.xobject_depth < 8 {
                        if let Some(subtype) = get_xobject_subtype(ctx.doc, ctx.page_id, &name) {
                            if subtype == b"Image" {
                                *ctx.image_count += 1;
                            } else if subtype == b"Form" {
                                // Recurse into Form XObject content stream
                                invoke_form_xobject(ctx, stack, blocks, idx, &name);
                            }
                        }
                    }
                }
            }

            _ => {}
        }
    }
}

// ── Form XObject recursion ────────────────────────────────────────────────

fn get_xobject_subtype(doc: &Document, page_id: ObjectId, name: &[u8]) -> Option<Vec<u8>> {
    let page_obj = doc.get_object(page_id).ok()?;
    let page_dict = page_obj.as_dict().ok()?;
    let res_obj = page_dict.get(b"Resources").ok()?;
    let resources = get_dict(doc, res_obj)?;
    let xobj_obj = resources.get(b"XObject").ok()?;
    let xobj_dict = get_dict(doc, xobj_obj)?;
    let entry = xobj_dict.get(name).ok()?;
    let stream = match resolve_object(doc, entry)? {
        Object::Stream(s) => s,
        _ => return None,
    };
    stream.dict.get(b"Subtype").ok().and_then(|o| {
        if let Object::Name(n) = o { Some(n.clone()) } else { None }
    })
}

fn invoke_form_xobject(
    ctx: &mut InterpContext<'_>,
    stack: &mut Vec<GraphicsState>,
    blocks: &mut Vec<WasmBlock>,
    idx: &mut usize,
    name: &[u8],
) {
    // Locate the Form XObject stream
    let xobj_stream_result: Option<(Vec<u8>, Option<Matrix>)> = (|| {
        let page_obj = ctx.doc.get_object(ctx.page_id).ok()?;
        let page_dict = page_obj.as_dict().ok()?;
        let res_obj = page_dict.get(b"Resources").ok()?;
        let resources = get_dict(ctx.doc, res_obj)?;
        let xobj_obj = resources.get(b"XObject").ok()?;
        let xobj_dict = get_dict(ctx.doc, xobj_obj)?;
        let entry = xobj_dict.get(name).ok()?;
        let stream = match resolve_object(ctx.doc, entry)? {
            Object::Stream(s) => s,
            _ => return None,
        };

        // Optional /Matrix in the Form XObject
        let matrix = stream.dict.get(b"Matrix").ok().and_then(|o| {
            if let Object::Array(a) = o {
                if a.len() >= 6 {
                    Some(Matrix {
                        a: obj_f64(&a[0]),
                        b: obj_f64(&a[1]),
                        c: obj_f64(&a[2]),
                        d: obj_f64(&a[3]),
                        e: obj_f64(&a[4]),
                        f: obj_f64(&a[5]),
                    })
                } else { None }
            } else { None }
        });

        Some((stream.content.clone(), matrix))
    })();

    let Some((content_bytes, xobj_matrix)) = xobj_stream_result else { return };

    let parsed = match Content::decode(&content_bytes) {
        Ok(c) => c,
        Err(e) => {
            ctx.warnings.push(format!(
                "Form XObject decode error on page {}: {e}",
                ctx.page_index
            ));
            return;
        }
    };

    // Push a new graphics state; apply the Form XObject's /Matrix if present
    let mut new_state = stack.last().unwrap().clone();
    if let Some(m) = xobj_matrix {
        new_state.ctm = m.multiply(&new_state.ctm);
    }
    stack.push(new_state);

    ctx.xobject_depth += 1;
    interpret_content(ctx, &parsed.operations, stack, blocks, idx);
    ctx.xobject_depth -= 1;

    if stack.len() > 1 { stack.pop(); }
}

// ── Decode helper ─────────────────────────────────────────────────────────

fn decode_with_font(bytes: &[u8], font_info: &Option<PageFontInfo>, unmapped: &mut usize) -> String {
    let empty = HashMap::new();
    let (map, two_byte) = match font_info {
        Some(fi) => (&fi.unicode_map, fi.is_two_byte),
        None => (&empty, false),
    };
    decode_bytes(bytes, map, two_byte, None, unmapped)
}

// ── parse_page public entry point ─────────────────────────────────────────

pub fn parse_page(
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
            warnings.push(format!("Failed to decode page {page_index} content: {e}"));
            return vec![];
        }
    };

    let mut blocks: Vec<WasmBlock> = Vec::new();
    let mut idx = 0usize;
    let mut stack: Vec<GraphicsState> = vec![GraphicsState::default()];

    let mut ctx = InterpContext {
        doc,
        page_id,
        page_index,
        page_height,
        page_width,
        warnings,
        unmapped_chars,
        vector_paths,
        image_count,
        missing_fonts_count,
        xobject_depth: 0,
    };

    interpret_content(&mut ctx, &content.operations, &mut stack, &mut blocks, &mut idx);

    assign_columns_and_links(&mut blocks, page_width);
    blocks
}
