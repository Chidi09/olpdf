use std::collections::HashMap;
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct FontMeta {
    pub family: String,
    pub size: f64,
    pub is_bold: bool,
    pub is_italic: bool,
    pub color: String,
}

#[derive(Serialize, Clone)]
pub struct RichSpan {
    pub text: String,
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strikethrough: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link_href: Option<String>,
    pub mark: bool,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub vertical_align: String,
}

#[derive(Serialize, Clone)]
pub struct WasmBlock {
    pub id: String,
    pub object_id: String,
    pub source_ref: String,
    #[serde(rename = "type")]
    pub block_type: String,
    pub content: String,
    pub rich_spans: Vec<RichSpan>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_block_id: Option<String>,
    pub page_index: usize,
    pub bounding_box: [f64; 4],
    pub font_meta: FontMeta,
    pub alignment: String,
    pub confidence_score: f64,
    pub needs_review: bool,
    pub z_index: usize,
    pub column_index: usize,
    pub style_overrides: HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bullet: Option<String>,
    #[serde(default)]
    pub is_invisible: bool,
}

#[derive(Serialize, Clone)]
pub struct WasmLayoutObject {
    pub id: String,
    #[serde(rename = "type")]
    pub object_type: String,
    pub page_index: usize,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub rotation: f64,
    pub z_index: usize,
    pub source_ref: String,
    pub original_pdf_object_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_align: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rows: Option<Vec<Vec<String>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
}

#[derive(Clone)]
pub struct Matrix {
    pub a: f64,
    pub b: f64,
    pub c: f64,
    pub d: f64,
    pub e: f64,
    pub f: f64,
}

impl Default for Matrix {
    fn default() -> Self {
        Self { a: 1.0, b: 0.0, c: 0.0, d: 1.0, e: 0.0, f: 0.0 }
    }
}

impl Matrix {
    pub fn multiply(&self, other: &Self) -> Self {
        Self {
            a: self.a * other.a + self.b * other.c,
            b: self.a * other.b + self.b * other.d,
            c: self.c * other.a + self.d * other.c,
            d: self.c * other.b + self.d * other.d,
            e: self.e * other.a + self.f * other.c + other.e,
            f: self.e * other.b + self.f * other.d + other.f,
        }
    }

    pub fn transform(&self, x: f64, y: f64) -> (f64, f64) {
        (x * self.a + y * self.c + self.e, x * self.b + y * self.d + self.f)
    }
}

#[derive(Clone)]
pub struct GraphicsState {
    pub ctm: Matrix,
    pub font_name: String,
    pub font_size: f64,
    pub fill_color: String,
    pub stroke_color: String,
    pub leading: f64,
    pub render_mode: i64,
    pub char_spacing: f64,
    pub word_spacing: f64,
    pub horiz_scale: f64,
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
            char_spacing: 0.0,
            word_spacing: 0.0,
            horiz_scale: 1.0,
        }
    }
}

#[derive(Serialize)]
pub struct WasmPageDimension {
    pub page_index: usize,
    pub width: f64,
    pub height: f64,
}

#[derive(Serialize)]
pub struct ParseMetrics {
    pub duration_ms: f64,
    pub total_blocks: usize,
    pub unmapped_chars: usize,
    pub pages_failed: usize,
    pub warnings: Vec<String>,
    pub image_count: usize,
    pub missing_fonts_count: usize,
    pub is_likely_scanned: bool,
}

#[derive(Serialize)]
pub struct ParseResult {
    pub blocks: Vec<WasmBlock>,
    pub layout_objects: Vec<WasmLayoutObject>,
    pub page_dimensions: Vec<WasmPageDimension>,
    pub metrics: ParseMetrics,
}

#[derive(Serialize)]
pub struct PreflightResult {
    pub page_count: usize,
    pub page_dimensions: Vec<WasmPageDimension>,
}

pub struct PageFontInfo {
    pub unicode_map: HashMap<u16, char>,
    pub widths: Vec<f64>,
    pub first_char: i64,
    pub default_width: f64,
    /// For CIDFont /W: sparse map from CID → width (glyph units)
    pub cid_widths: HashMap<u32, f64>,
    pub cid_default_width: f64,
    /// True when character codes are 2 bytes wide (Type0/CIDFont)
    pub is_two_byte: bool,
}
