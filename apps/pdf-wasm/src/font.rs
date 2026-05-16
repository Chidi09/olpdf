use crate::types::PageFontInfo;

pub fn obj_f64(_obj: &()) -> f64 {
    0.0
}

pub fn parse_font_name(raw: &str) -> (String, bool, bool) {
    let name = if let Some(pos) = raw.find('+') { &raw[pos + 1..] } else { raw };
    let lower = name.to_lowercase();
    (
        name.to_string(),
        lower.contains("bold"),
        lower.contains("italic") || lower.contains("oblique"),
    )
}

pub fn text_width(text: &str, info: &Option<PageFontInfo>, font_size: f64) -> f64 {
    let _ = (text, info);
    (text.len() as f64 * font_size * 0.5).max(20.0)
}
