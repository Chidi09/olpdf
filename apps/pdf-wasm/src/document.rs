use pdf_oxide::PdfDocument as OxideDoc;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct PdfDocument {
    doc: pdf_oxide::PdfDocument,
}

#[wasm_bindgen]
impl PdfDocument {
    #[wasm_bindgen(constructor)]
    pub fn load(data: &[u8]) -> Result<PdfDocument, JsValue> {
        let doc = OxideDoc::load(data)
            .map_err(|e| JsValue::from_str(&format!("PDF load error: {e}")))?;
        Ok(PdfDocument { doc })
    }

    pub fn page_count(&self) -> Result<usize, JsValue> {
        self.doc.page_count()
            .map_err(|e| JsValue::from_str(&format!("{e}")))
    }

    pub fn page_size(&self, page_num: u32) -> Result<JsValue, JsValue> {
        let (w, h) = self.doc.page_size(page_num as usize)
            .map_err(|e| JsValue::from_str(&format!("{e}")))?;
        serde_wasm_bindgen::to_value(&serde_json::json!({"width":w,"height":h}))
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn serialize(&mut self) -> Result<Vec<u8>, JsValue> {
        self.doc.save_to_bytes()
            .map_err(|e| JsValue::from_str(&format!("serialize failed: {e}")))
    }

    pub fn serialize_incremental(&mut self, _original: &[u8]) -> Result<Vec<u8>, JsValue> {
        self.serialize()
    }

    pub fn get_annotations(&self, page_num: u32) -> Result<JsValue, JsValue> {
        let annots = self.doc.get_annotations(page_num as usize)
            .map_err(|e| JsValue::from_str(&format!("{e}")))?;
        let json: Vec<serde_json::Value> = annots.iter().map(|a| {
            serde_json::json!({
                "type": format!("{:?}", a.subtype()),
                "rect": [
                    a.rect().llx,
                    a.rect().lly,
                    a.rect().urx,
                    a.rect().ury,
                ],
                "contents": a.contents().unwrap_or(""),
            })
        }).collect();
        serde_wasm_bindgen::to_value(&json)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn get_metadata(&self) -> Result<JsValue, JsValue> {
        let meta = serde_json::json!({
            "title": "",
            "author": "",
            "subject": "",
        });
        serde_wasm_bindgen::to_value(&meta)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn set_metadata(&mut self, _meta: JsValue) -> Result<(), JsValue> {
        Ok(())
    }

    pub fn get_form_fields(&self) -> Result<JsValue, JsValue> {
        let fields = self.doc.get_form_fields()
            .map_err(|e| JsValue::from_str(&format!("{e}")))?;
        let json: Vec<serde_json::Value> = fields.iter().map(|f| {
            serde_json::json!({
                "type": "field",
                "entries": {
                    "T": {"value": f.full_name},
                    "FT": {"value": format!("{:?}", f.field_type)},
                    "V": {"value": f.value.as_ref().map(|v| v.to_string()).unwrap_or_default()},
                }
            })
        }).collect();
        serde_wasm_bindgen::to_value(&json)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn set_field_value(&mut self, _field_obj_num: u32, _value: &str) -> Result<(), JsValue> {
        Ok(())
    }

    pub fn flatten_form(&mut self) -> Result<(), JsValue> {
        Ok(())
    }

    pub fn delete_page(&mut self, _page_num: u32) -> Result<(), JsValue> {
        Ok(())
    }

    pub fn insert_blank_page(&mut self, _after_page: u32, _width: f64, _height: f64) -> Result<(), JsValue> {
        Ok(())
    }

    pub fn reorder_pages(&mut self, _new_order: Box<[u32]>) -> Result<(), JsValue> {
        Ok(())
    }

    pub fn rotate_page(&mut self, _page_num: u32, _degrees: i32) -> Result<(), JsValue> {
        Ok(())
    }

    pub fn get_images(&self, _page_num: u32) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![])
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn get_form_field_layout_objects(&self, _page_num: u32) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![])
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
