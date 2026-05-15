use wasm_bindgen::prelude::*;
use lopdf::Object;

use crate::font::obj_f64;
use crate::hash::stable_object_id;
use crate::objects::{dict_entries, json_value_to_object, object_to_json_value};
use crate::types::WasmLayoutObject;
use crate::lib_helpers::BASE64_STANDARD;
use base64::Engine;

#[wasm_bindgen]
pub struct PdfDocument {
    pub(crate) doc: lopdf::Document,
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
        let page_id = *pages
            .get(&page_num)
            .ok_or_else(|| JsValue::from_str("page not found"))?;
        let (w, h) = crate::page::get_page_size(&self.doc, page_id);
        serde_wasm_bindgen::to_value(&serde_json::json!({"width":w,"height":h}))
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn get_object(&self, obj_num: u32, gen_num: u16) -> Result<JsValue, JsValue> {
        let obj = self
            .doc
            .get_object((obj_num, gen_num))
            .map_err(|e| JsValue::from_str(&format!("get_object failed: {e}")))?;
        let json = object_to_json_value(obj);
        serde_wasm_bindgen::to_value(&json).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn set_object(&mut self, obj_num: u32, gen_num: u16, value: JsValue) -> Result<(), JsValue> {
        let json: serde_json::Value = serde_wasm_bindgen::from_value(value)
            .map_err(|e| JsValue::from_str(&format!("invalid JSON: {e}")))?;
        let obj = json_value_to_object(&json).map_err(|e| JsValue::from_str(&e))?;
        self.doc.objects.insert((obj_num, gen_num), obj);
        Ok(())
    }

    pub fn add_object(&mut self, value: JsValue) -> Result<u32, JsValue> {
        let json: serde_json::Value = serde_wasm_bindgen::from_value(value)
            .map_err(|e| JsValue::from_str(&format!("invalid JSON: {e}")))?;
        let obj = json_value_to_object(&json).map_err(|e| JsValue::from_str(&e))?;
        let id = self.doc.add_object(obj);
        Ok(id.0)
    }

    pub fn serialize(&mut self) -> Result<Vec<u8>, JsValue> {
        let mut buf = Vec::new();
        self.doc
            .save_to(&mut buf)
            .map_err(|e| JsValue::from_str(&format!("serialize failed: {e}")))?;
        Ok(buf)
    }

    pub fn serialize_incremental(&mut self, _original: &[u8]) -> Result<Vec<u8>, JsValue> {
        // Performs a full rewrite for now (true incremental update requires
        // preserving the original byte range and appending only the diff).
        self.serialize()
    }

    // ── Annotations ───────────────────────────────────────────────────────

    pub fn get_annotations(&self, page_num: u32) -> Result<JsValue, JsValue> {
        let pages = self.doc.get_pages();
        let page_id = *pages
            .get(&page_num)
            .ok_or_else(|| JsValue::from_str("page not found"))?;
        let annots = self.resolve_annots(page_id);
        let mut results = Vec::new();
        for annot_ref in &annots {
            if let Object::Reference(id) = annot_ref {
                if let Ok(obj) = self.doc.get_object(*id) {
                    results.push(object_to_json_value(obj));
                }
            }
        }
        serde_wasm_bindgen::to_value(&results).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn add_annotation(&mut self, page_num: u32, annotation: JsValue) -> Result<u32, JsValue> {
        let json: serde_json::Value = serde_wasm_bindgen::from_value(annotation)
            .map_err(|e| JsValue::from_str(&format!("invalid JSON: {e}")))?;
        let obj = json_value_to_object(&json).map_err(|e| JsValue::from_str(&e))?;
        let id = self.doc.add_object(obj);

        let pages = self.doc.get_pages();
        let page_id = *pages
            .get(&page_num)
            .ok_or_else(|| JsValue::from_str("page not found"))?;
        let mut annots = self.resolve_annots(page_id);
        annots.push(Object::Reference((id.0, 0)));

        if let Ok(page_obj) = self.doc.get_object_mut(page_id) {
            if let Ok(dict) = page_obj.as_dict_mut() {
                dict.set(b"Annots".to_vec(), Object::Array(annots));
            }
        }
        Ok(id.0)
    }

    pub fn remove_annotation(&mut self, page_num: u32, annot_obj_num: u32) -> Result<(), JsValue> {
        let pages = self.doc.get_pages();
        let page_id = *pages
            .get(&page_num)
            .ok_or_else(|| JsValue::from_str("page not found"))?;
        let filtered: Vec<Object> = self
            .resolve_annots(page_id)
            .into_iter()
            .filter(|o| !matches!(o, Object::Reference((n, _)) if *n == annot_obj_num))
            .collect();

        if let Ok(page_obj) = self.doc.get_object_mut(page_id) {
            if let Ok(dict) = page_obj.as_dict_mut() {
                dict.set(b"Annots".to_vec(), Object::Array(filtered));
            }
        }
        self.doc.objects.remove(&(annot_obj_num, 0));
        Ok(())
    }

    fn resolve_annots(&self, page_id: (u32, u16)) -> Vec<Object> {
        self.doc
            .get_object(page_id)
            .ok()
            .and_then(|o| o.as_dict().ok())
            .and_then(|d| d.get(b"Annots").ok())
            .and_then(|o| match o {
                Object::Array(a) => Some(a.clone()),
                Object::Reference(id) => self
                    .doc
                    .get_object(*id)
                    .ok()
                    .and_then(|r| r.as_array().ok())
                    .map(|a| a.clone()),
                _ => None,
            })
            .unwrap_or_default()
    }

    // ── Metadata ──────────────────────────────────────────────────────────

    pub fn get_metadata(&self) -> Result<JsValue, JsValue> {
        let result = self
            .doc
            .trailer
            .get(b"Info")
            .ok()
            .and_then(|o| match o {
                Object::Reference(id) => self
                    .doc
                    .get_object(*id)
                    .ok()
                    .and_then(|o| o.as_dict().ok())
                    .map(dict_entries),
                Object::Dictionary(d) => Some(dict_entries(d)),
                _ => None,
            })
            .unwrap_or(serde_json::Value::Null);
        serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn set_metadata(&mut self, meta: JsValue) -> Result<(), JsValue> {
        let json: serde_json::Value = serde_wasm_bindgen::from_value(meta)
            .map_err(|e| JsValue::from_str(&format!("invalid JSON: {e}")))?;
        let mut dict = lopdf::Dictionary::new();
        if let Some(obj) = json.as_object() {
            for (k, v) in obj {
                dict.set(k.as_bytes().to_vec(), json_value_to_object(v).map_err(|e| JsValue::from_str(&e))?);
            }
        }
        let id = self.doc.add_object(Object::Dictionary(dict));
        self.doc.trailer.set(b"Info".to_vec(), Object::Reference((id.0, 0)));
        Ok(())
    }

    // ── Form fields ───────────────────────────────────────────────────────

    pub fn get_form_fields(&self) -> Result<JsValue, JsValue> {
        let fields = self.collect_form_fields();
        serde_wasm_bindgen::to_value(&fields).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn set_field_value(&mut self, field_obj_num: u32, value: &str) -> Result<(), JsValue> {
        if let Ok(field) = self.doc.get_object_mut((field_obj_num, 0)) {
            if let Ok(dict) = field.as_dict_mut() {
                dict.set(b"V".to_vec(), Object::string_literal(value));
            }
        }
        // Mark NeedAppearances so PDF viewers regenerate field appearance streams
        self.set_need_appearances(true);
        Ok(())
    }

    pub fn flatten_form(&mut self) -> Result<(), JsValue> {
        if let Some(Object::Reference(cat_ref)) = self.doc.trailer.get(b"Root").ok() {
            let cat_ref = *cat_ref;
            if let Ok(catalog) = self.doc.get_object_mut(cat_ref) {
                if let Ok(dict) = catalog.as_dict_mut() {
                    dict.remove(b"AcroForm");
                }
            }
        }
        Ok(())
    }

    // ── Page operations ───────────────────────────────────────────────────

    pub fn delete_page(&mut self, page_num: u32) -> Result<(), JsValue> {
        self.doc.delete_pages(&[page_num]);
        Ok(())
    }

    pub fn insert_blank_page(&mut self, after_page: u32, width: f64, height: f64) -> Result<(), JsValue> {
        let mut page_dict = lopdf::Dictionary::new();
        page_dict.set(b"Type".to_vec(), Object::Name(b"Page".to_vec()));
        page_dict.set(b"MediaBox".to_vec(), Object::Array(vec![
            Object::Integer(0),
            Object::Integer(0),
            Object::Real(width as f32),
            Object::Real(height as f32),
        ]));
        page_dict.set(b"Contents".to_vec(), Object::Stream(
            lopdf::Stream::new(lopdf::Dictionary::new(), vec![])
        ));
        let new_page_id = self.doc.add_object(Object::Dictionary(page_dict));

        let pages = self.doc.get_pages();
        let total = pages.len() as u32;
        let after = after_page.min(total);
        let mut page_ids: Vec<_> = pages.into_iter().collect();
        page_ids.sort_by_key(|(k, _)| *k);

        if after < total {
            page_ids.insert(after as usize, (after + 1, new_page_id));
        } else {
            page_ids.push((total + 1, new_page_id));
        }

        let kids: Vec<_> = page_ids.iter().map(|(_, id)| Object::Reference(*id)).collect();
        self.update_pages_tree(kids, total as i64 + 1);
        Ok(())
    }

    pub fn reorder_pages(&mut self, new_order: Box<[u32]>) -> Result<(), JsValue> {
        let pages = self.doc.get_pages();
        let mut page_map: Vec<_> = pages.into_iter().collect();
        page_map.sort_by_key(|(k, _)| *k);

        let reordered: Vec<_> = new_order
            .iter()
            .filter_map(|n| page_map.iter().find(|(k, _)| k == n).map(|(_, id)| *id))
            .collect();

        if reordered.is_empty() {
            return Err(JsValue::from_str("no valid page numbers"));
        }

        let count = reordered.len() as i64;
        let kids: Vec<_> = reordered.iter().map(|id| Object::Reference(*id)).collect();
        self.update_pages_tree(kids, count);
        Ok(())
    }

    pub fn rotate_page(&mut self, page_num: u32, degrees: i32) -> Result<(), JsValue> {
        let pages = self.doc.get_pages();
        let page_id = *pages
            .get(&page_num)
            .ok_or_else(|| JsValue::from_str("page not found"))?;
        if let Ok(page_obj) = self.doc.get_object_mut(page_id) {
            if let Ok(dict) = page_obj.as_dict_mut() {
                let current = dict
                    .get(b"Rotate")
                    .map(|o| match o { Object::Integer(n) => *n, _ => 0 })
                    .unwrap_or(0);
                dict.set(b"Rotate".to_vec(), Object::Integer((current + degrees as i64).rem_euclid(360)));
            }
        }
        Ok(())
    }

    // ── Images ────────────────────────────────────────────────────────────

    pub fn get_images(&self, page_num: u32) -> Result<JsValue, JsValue> {
        let pages = self.doc.get_pages();
        let page_id = *pages
            .get(&page_num)
            .ok_or_else(|| JsValue::from_str("page not found"))?;
        let page_obj = self.doc.get_object(page_id)
            .map_err(|_| JsValue::from_str("cannot get page"))?;
        let dict = page_obj.as_dict()
            .map_err(|_| JsValue::from_str("page not a dict"))?;

        let resources = match dict.get(b"Resources").ok() {
            Some(Object::Reference(id)) => self.doc.get_object(*id).ok(),
            Some(other) => Some(other),
            None => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let xobjects = match resources.and_then(|o| o.as_dict().ok()) {
            Some(d) => d.get(b"XObject").ok(),
            None => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };
        let xobj_dict = match xobjects {
            Some(Object::Dictionary(d)) => d,
            Some(Object::Reference(id)) => match self.doc.get_object(*id).ok().and_then(|o| o.as_dict().ok()) {
                Some(d) => d,
                None => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
            },
            _ => return Ok(serde_wasm_bindgen::to_value::<Vec<serde_json::Value>>(&vec![]).unwrap()),
        };

        let mut results = Vec::new();
        for (k, v) in xobj_dict.iter() {
            let obj = match v {
                Object::Reference(id) => self.doc.get_object(*id).ok(),
                other => Some(other),
            };
            if let Some(Object::Stream(stream)) = obj {
                let is_image = stream
                    .dict
                    .get(b"Subtype")
                    .ok()
                    .map_or(false, |o| matches!(o, Object::Name(n) if n == b"Image"));
                if is_image {
                    results.push(serde_json::json!({
                        "name": String::from_utf8_lossy(k),
                        "width": stream.dict.get(b"Width").ok().map(obj_f64),
                        "height": stream.dict.get(b"Height").ok().map(obj_f64),
                        "data": BASE64_STANDARD.encode(&stream.content),
                    }));
                }
            }
        }
        serde_wasm_bindgen::to_value(&results).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    // ── Form field layout objects ─────────────────────────────────────────
    //
    // Fixed: Rect coords were raw PDF (bottom-up). Now flipped to screen coords.

    pub fn get_form_field_layout_objects(&self, page_num: u32) -> Result<JsValue, JsValue> {
        let pages = self.doc.get_pages();
        let page_id = *pages
            .get(&page_num)
            .ok_or_else(|| JsValue::from_str("page not found"))?;
        let (_, page_height) = crate::page::get_page_size(&self.doc, page_id);

        let fields = self.collect_form_fields();
        let mut objects: Vec<WasmLayoutObject> = Vec::new();

        for (i, field) in fields.iter().enumerate() {
            if let Some(obj) = form_field_to_layout_object(field, (page_num - 1) as usize, i, page_height) {
                objects.push(obj);
            }
        }

        serde_wasm_bindgen::to_value(&objects).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    // ── Private helpers ───────────────────────────────────────────────────

    fn collect_form_fields(&self) -> Vec<serde_json::Value> {
        let catalog = match self.doc.catalog() {
            Ok(c) => c,
            Err(_) => return vec![],
        };
        let acroform = match catalog.get(b"AcroForm").ok() {
            Some(Object::Reference(id)) => self.doc.get_object(*id).ok(),
            Some(other) => Some(other),
            None => return vec![],
        };
        let fields_array = match acroform.and_then(|o| o.as_dict().ok()) {
            Some(d) => d.get(b"Fields").ok(),
            None => return vec![],
        };
        let fields: Vec<Object> = match fields_array {
            Some(Object::Array(a)) => a.clone(),
            _ => return vec![],
        };
        let mut results = Vec::new();
        for field_ref in &fields {
            if let Object::Reference(id) = field_ref {
                if let Ok(obj) = self.doc.get_object(*id) {
                    results.push(object_to_json_value(obj));
                }
            }
        }
        results
    }

    fn set_need_appearances(&mut self, value: bool) {
        let cat_ref = match self.doc.trailer.get(b"Root").ok() {
            Some(Object::Reference(r)) => *r,
            _ => return,
        };
        let af_ref = match self.doc.get_object(cat_ref).ok()
            .and_then(|o| o.as_dict().ok())
            .and_then(|d| d.get(b"AcroForm").ok())
        {
            Some(Object::Reference(r)) => *r,
            _ => return,
        };
        if let Ok(af) = self.doc.get_object_mut(af_ref) {
            if let Ok(dict) = af.as_dict_mut() {
                dict.set(b"NeedAppearances".to_vec(), Object::Boolean(value));
            }
        }
    }

    fn update_pages_tree(&mut self, kids: Vec<Object>, count: i64) {
        let cat_ref = match self.doc.trailer.get(b"Root").ok() {
            Some(Object::Reference(r)) => *r,
            _ => return,
        };
        let pages_ref = match self.doc.get_object(cat_ref).ok()
            .and_then(|o| o.as_dict().ok())
            .and_then(|d| d.get(b"Pages").ok())
        {
            Some(Object::Reference(r)) => *r,
            _ => return,
        };
        if let Ok(pages_obj) = self.doc.get_object_mut(pages_ref) {
            if let Ok(dict) = pages_obj.as_dict_mut() {
                dict.set(b"Kids".to_vec(), Object::Array(kids));
                dict.set(b"Count".to_vec(), Object::Integer(count));
            }
        }
    }
}

// ── Form field → layout object (with coordinate flip) ────────────────────

fn form_field_to_layout_object(
    field: &serde_json::Value,
    page_index: usize,
    idx: usize,
    page_height: f64,
) -> Option<WasmLayoutObject> {
    let obj = field.as_object()?;
    let entries = obj.get("entries")?.as_object()?;

    let get_str = |key: &str| -> Option<String> {
        entries.get(key)?.get("value")?.as_str().map(|s| s.to_string())
    };
    let get_f64 = |key: &str| -> Option<f64> {
        entries.get(key)?.get("value")?.as_f64()
    };

    let ft = get_str("FT").unwrap_or_else(|| "Tx".to_string());
    let t  = get_str("T").unwrap_or_else(|| "field".to_string());
    let v  = get_str("V").unwrap_or_default();

    // Rect is an array: [llx, lly, urx, ury] in PDF coords (bottom-up)
    let rect = entries.get("Rect")?.get("items")?.as_array()?;
    if rect.len() < 4 { return None; }
    let llx = rect[0].get("value")?.as_f64()?;
    let lly = rect[1].get("value")?.as_f64()?;
    let urx = rect[2].get("value")?.as_f64()?;
    let ury = rect[3].get("value")?.as_f64()?;

    let w = urx - llx;
    let h = ury - lly;

    // Convert from PDF bottom-up to screen top-down
    let screen_y = page_height - ury;
    let bbox = [llx, screen_y, urx, screen_y + h];

    let required = entries.get("Ff")
        .and_then(|o| o.get("value"))
        .and_then(|v| v.as_i64())
        .map(|flags| (flags & (1 << 1)) != 0)
        .unwrap_or(false);

    let source_ref = format!("page:{page_index}:form:{t}");
    let id = stable_object_id("form", page_index, &source_ref, bbox);

    Some(WasmLayoutObject {
        id: id.clone(),
        object_type: "form_field".to_string(),
        page_index,
        x: llx,
        y: screen_y,
        width: w,
        height: h,
        rotation: 0.0,
        z_index: 10000 + idx,
        source_ref,
        original_pdf_object_id: id,
        content: Some(v.clone()),
        font_family: None,
        font_size: None,
        color: None,
        text_align: None,
        rows: None,
        field_name: Some(t),
        field_type: Some(ft),
        value: Some(v),
        required: Some(required),
    })
}
