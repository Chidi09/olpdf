use base64::Engine;
use lopdf::Object;

use crate::lib_helpers::BASE64_STANDARD;

pub fn dict_entries(dict: &lopdf::Dictionary) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for (k, v) in dict.iter() {
        map.insert(String::from_utf8_lossy(k).to_string(), object_to_json_value(v));
    }
    serde_json::Value::Object(map)
}

pub fn object_to_json_value(obj: &Object) -> serde_json::Value {
    match obj {
        Object::Null => serde_json::Value::Null,
        Object::Boolean(b) => serde_json::json!({"type":"bool","value":b}),
        Object::Integer(n) => serde_json::json!({"type":"integer","value":n}),
        Object::Real(f) => serde_json::json!({"type":"real","value":f}),
        Object::Name(n) => serde_json::json!({"type":"name","value":String::from_utf8_lossy(n)}),
        Object::String(bytes, _) => {
            serde_json::json!({"type":"string","value":String::from_utf8_lossy(bytes)})
        }
        Object::Array(items) => {
            let arr: Vec<serde_json::Value> = items.iter().map(object_to_json_value).collect();
            serde_json::json!({"type":"array","items":arr})
        }
        Object::Dictionary(d) => serde_json::json!({"type":"dict","entries":dict_entries(d)}),
        Object::Stream(stream) => {
            serde_json::json!({
                "type": "stream",
                "stream": {
                    "dict": dict_entries(&stream.dict),
                    "decoded": BASE64_STANDARD.encode(&stream.content),
                }
            })
        }
        Object::Reference((n, g)) => serde_json::json!({"type":"ref","obj":n,"gen":g}),
    }
}

pub fn json_value_to_object(val: &serde_json::Value) -> Result<Object, String> {
    let obj_type = val.get("type").and_then(|t| t.as_str()).unwrap_or("");
    match obj_type {
        "null" => Ok(Object::Null),
        "bool" => Ok(Object::Boolean(
            val.get("value").and_then(|v| v.as_bool()).unwrap_or(false),
        )),
        "integer" => Ok(Object::Integer(
            val.get("value").and_then(|v| v.as_i64()).unwrap_or(0),
        )),
        "real" => Ok(Object::Real(
            val.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
        )),
        "name" => {
            let s = val.get("value").and_then(|v| v.as_str()).unwrap_or("");
            Ok(Object::Name(s.as_bytes().to_vec()))
        }
        "string" => {
            let s = val.get("value").and_then(|v| v.as_str()).unwrap_or("");
            Ok(Object::String(s.as_bytes().to_vec(), lopdf::StringFormat::Literal))
        }
        "array" => {
            let items = val
                .get("items")
                .and_then(|v| v.as_array())
                .ok_or("array missing items")?;
            let objs: Result<Vec<_>, _> = items.iter().map(json_value_to_object).collect();
            Ok(Object::Array(objs?))
        }
        "dict" => {
            let entries = val
                .get("entries")
                .and_then(|v| v.as_object())
                .ok_or("dict missing entries")?;
            let mut dict = lopdf::Dictionary::new();
            for (k, v) in entries {
                dict.set(k.as_bytes().to_vec(), json_value_to_object(v)?);
            }
            Ok(Object::Dictionary(dict))
        }
        "ref" => {
            let obj = val.get("obj").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let gen = val.get("gen").and_then(|v| v.as_u64()).unwrap_or(0) as u16;
            Ok(Object::Reference((obj, gen)))
        }
        "stream" => {
            let sv = val.get("stream").ok_or("stream missing stream field")?;
            let dict_val = sv.get("dict").ok_or("stream missing dict")?;
            let dict_obj = json_value_to_object(dict_val)?;
            let dict = dict_obj.as_dict().map_err(|_| "stream dict is not a dict")?.clone();
            let decoded_str = sv.get("decoded").and_then(|v| v.as_str()).unwrap_or("");
            let content = BASE64_STANDARD
                .decode(decoded_str)
                .map_err(|e| format!("base64: {e}"))?;
            Ok(Object::Stream(lopdf::Stream::new(dict, content)))
        }
        _ => Err(format!("unknown object type: {obj_type}")),
    }
}
