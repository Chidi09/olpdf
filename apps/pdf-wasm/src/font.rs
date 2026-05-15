use std::collections::HashMap;
use lopdf::{Document, Object, ObjectId};

use crate::cmap::{parse_cmap, EncodingFallback, glyph_name_to_unicode};
use crate::types::PageFontInfo;

// ── Helpers ───────────────────────────────────────────────────────────────

pub fn obj_f64(obj: &Object) -> f64 {
    match obj {
        Object::Real(f) => *f as f64,
        Object::Integer(i) => *i as f64,
        _ => 0.0,
    }
}

pub fn resolve_object<'a>(doc: &'a Document, obj: &'a Object) -> Option<&'a Object> {
    match obj {
        Object::Reference(id) => doc.get_object(*id).ok(),
        other => Some(other),
    }
}

pub fn get_dict<'a>(doc: &'a Document, obj: &'a Object) -> Option<&'a lopdf::Dictionary> {
    resolve_object(doc, obj)?.as_dict().ok()
}

// ── Font name parsing ─────────────────────────────────────────────────────

/// Strips the subset prefix (e.g. "ABCDEF+Times-Bold" → "Times-Bold") and
/// returns (family_name, is_bold, is_italic).
pub fn parse_font_name(raw: &str) -> (String, bool, bool) {
    let name = if let Some(pos) = raw.find('+') { &raw[pos + 1..] } else { raw };
    let lower = name.to_lowercase();
    (
        name.to_string(),
        lower.contains("bold"),
        lower.contains("italic") || lower.contains("oblique"),
    )
}

// ── CIDFont /W array parser ───────────────────────────────────────────────
//
// Format: /W [cid [[w1 w2 ...]] cid_start cid_end width ...]
// Returns a HashMap<cid, width_in_glyph_units>.

fn parse_cid_widths(doc: &Document, w_obj: &Object) -> HashMap<u32, f64> {
    let arr = match resolve_object(doc, w_obj) {
        Some(Object::Array(a)) => a,
        _ => return HashMap::new(),
    };

    let mut map = HashMap::new();
    let mut i = 0;
    while i < arr.len() {
        let cid_start = obj_f64(&arr[i]) as u32;
        i += 1;
        if i >= arr.len() { break; }

        match &arr[i] {
            Object::Array(widths) => {
                // [ [w1 w2 w3 ...] ] — individual widths from cid_start
                for (offset, w) in widths.iter().enumerate() {
                    map.insert(cid_start + offset as u32, obj_f64(w));
                }
                i += 1;
            }
            _ => {
                // cid_end + single_width
                if i + 1 >= arr.len() { break; }
                let cid_end = obj_f64(&arr[i]) as u32;
                let width = obj_f64(&arr[i + 1]);
                i += 2;
                for cid in cid_start..=cid_end {
                    map.insert(cid, width);
                }
            }
        }
    }
    map
}

// ── /Encoding + /Differences fallback ───────────────────────────────────

fn load_encoding_fallback(doc: &Document, font_dict: &lopdf::Dictionary) -> Option<EncodingFallback> {
    let enc_obj = font_dict.get(b"Encoding").ok()?;
    let resolved = resolve_object(doc, enc_obj)?;

    // Simple name encoding
    if let Object::Name(n) = resolved {
        return match n.as_slice() {
            b"WinAnsiEncoding" => Some(EncodingFallback::WinAnsi),
            b"MacRomanEncoding" => Some(EncodingFallback::MacRoman),
            _ => None,
        };
    }

    // Encoding dictionary
    if let Object::Dictionary(enc_dict) = resolved {
        // Base encoding
        let mut base: Option<EncodingFallback> = enc_dict
            .get(b"BaseEncoding")
            .ok()
            .and_then(|o| if let Object::Name(n) = o {
                match n.as_slice() {
                    b"WinAnsiEncoding" => Some(EncodingFallback::WinAnsi),
                    b"MacRomanEncoding" => Some(EncodingFallback::MacRoman),
                    _ => None,
                }
            } else { None });

        // /Differences array: [first_code glyph_name glyph_name ...]
        if let Ok(diff_obj) = enc_dict.get(b"Differences") {
            if let Some(Object::Array(diffs)) = resolve_object(doc, diff_obj) {
                // Build a custom map starting from the base encoding
                let mut custom: HashMap<u8, char> = HashMap::new();

                // Seed from base if present
                for byte in 0u8..=255u8 {
                    let cp = match &base {
                        Some(EncodingFallback::WinAnsi) => {
                            use crate::cmap::WINANSI;
                            char::from_u32(WINANSI[byte as usize])
                        }
                        Some(EncodingFallback::MacRoman) => {
                            use crate::cmap::MACROMAN;
                            char::from_u32(MACROMAN[byte as usize])
                        }
                        _ => {
                            if byte.is_ascii_graphic() || byte == b' ' { Some(byte as char) } else { None }
                        }
                    };
                    if let Some(c) = cp { custom.insert(byte, c); }
                }

                let mut current_code: u8 = 0;
                for item in diffs.iter() {
                    match item {
                        Object::Integer(n) => { current_code = (*n as u8); }
                        Object::Name(glyph_bytes) => {
                            let name = String::from_utf8_lossy(glyph_bytes);
                            if let Some(ch) = glyph_name_to_unicode(&name) {
                                custom.insert(current_code, ch);
                            }
                            current_code = current_code.wrapping_add(1);
                        }
                        _ => {}
                    }
                }
                return Some(EncodingFallback::Custom(custom));
            }
        }

        return base;
    }

    None
}

// ── Main font loader ──────────────────────────────────────────────────────

pub fn load_font_info(
    doc: &Document,
    page_id: ObjectId,
    font_name: &str,
    warnings: &mut Vec<String>,
    missing_fonts_count: &mut usize,
) -> Option<PageFontInfo> {
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

    // ── ToUnicode CMap ────────────────────────────────────────────────────
    let (unicode_map, is_two_byte) = if let Ok(tu) = font_dict.get(b"ToUnicode") {
        match resolve_object(doc, tu) {
            Some(Object::Stream(stream)) => parse_cmap(&stream.content),
            _ => {
                warnings.push(format!("Failed to resolve ToUnicode for font '{font_name}'"));
                (HashMap::new(), false)
            }
        }
    } else {
        (HashMap::new(), false)
    };

    // If no CMap, check for CIDFont with 2-byte code space via Subtype
    let is_two_byte = is_two_byte || matches!(
        font_dict.get(b"Subtype").ok(),
        Some(Object::Name(n)) if n == b"Type0"
    );

    // ── MissingWidth / default_width ──────────────────────────────────────
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

    // ── Type1/TrueType Widths ─────────────────────────────────────────────
    let mut first_char: i64 = 32;
    let mut widths = Vec::new();

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

    // ── CIDFont /W widths ─────────────────────────────────────────────────
    // Type0 fonts have a DescendantFonts array; the CIDFont dict holds /W and /DW.
    let mut cid_widths: HashMap<u32, f64> = HashMap::new();
    let mut cid_default_width = 1000.0;

    if let Ok(desc_arr_obj) = font_dict.get(b"DescendantFonts") {
        if let Some(Object::Array(arr)) = resolve_object(doc, desc_arr_obj) {
            if let Some(first) = arr.first() {
                if let Some(cid_dict) = get_dict(doc, first) {
                    if let Ok(dw) = cid_dict.get(b"DW") {
                        cid_default_width = obj_f64(dw);
                    }
                    if let Ok(w) = cid_dict.get(b"W") {
                        cid_widths = parse_cid_widths(doc, w);
                    }
                }
            }
        }
    }

    // ── /Encoding fallback (used when no ToUnicode) ───────────────────────
    // We store this on PageFontInfo via a side-effect: if there's no ToUnicode
    // but we can build a fallback, we synthesise the unicode_map from it so
    // decode_bytes() can use path 2 (CMap) without a code path change.
    let unicode_map = if unicode_map.is_empty() {
        if let Some(fallback) = load_encoding_fallback(doc, font_dict) {
            // Materialise the fallback into the unicode_map so existing
            // single-byte decode logic still works unchanged.
            match fallback {
                EncodingFallback::WinAnsi => {
                    use crate::cmap::WINANSI;
                    (0u16..=255).filter_map(|b| {
                        char::from_u32(WINANSI[b as usize]).map(|c| (b, c))
                    }).collect()
                }
                EncodingFallback::MacRoman => {
                    use crate::cmap::MACROMAN;
                    (0u16..=255).filter_map(|b| {
                        char::from_u32(MACROMAN[b as usize]).map(|c| (b, c))
                    }).collect()
                }
                EncodingFallback::Custom(m) => {
                    m.into_iter().map(|(b, c)| (b as u16, c)).collect()
                }
            }
        } else {
            if unicode_map.is_empty() {
                warnings.push(format!("No ToUnicode CMap or Encoding for font '{font_name}'"));
            }
            unicode_map
        }
    } else {
        unicode_map
    };

    Some(PageFontInfo {
        unicode_map,
        widths,
        first_char,
        default_width,
        cid_widths,
        cid_default_width,
        is_two_byte,
    })
}

// ── Width calculation ─────────────────────────────────────────────────────

/// Compute the rendered width of `text` in PDF user-space units.
pub fn text_width(text: &str, info: &Option<PageFontInfo>, font_size: f64) -> f64 {
    let Some(fi) = info else {
        return (text.len() as f64 * font_size * 0.5).max(20.0);
    };

    if !fi.cid_widths.is_empty() || fi.is_two_byte {
        // CIDFont: sum per-CID widths using the unicode_map in reverse
        // (best approximation without full glyph-to-CID reverse map)
        let total: f64 = text.chars().map(|_| fi.cid_default_width).sum();
        return total * font_size / 1000.0;
    }

    if !fi.widths.is_empty() {
        return text
            .bytes()
            .map(|b| {
                let idx = ((b as i64) - fi.first_char).max(0) as usize;
                fi.widths.get(idx).copied().unwrap_or(fi.default_width)
            })
            .sum::<f64>()
            * font_size
            / 1000.0;
    }

    (text.len() as f64 * font_size * 0.5).max(20.0)
}

// Re-export WINANSI and MACROMAN so font.rs callers (encoding fallback seed)
// can reach the tables from within this crate.
pub use crate::cmap::{WINANSI, MACROMAN};
