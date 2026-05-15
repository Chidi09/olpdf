pub fn quantize(v: f64) -> i64 {
    (v * 100.0).round() as i64
}

pub fn fnv1a_64(input: &str) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in input.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

pub fn stable_object_id(kind: &str, page_index: usize, source_ref: &str, bbox: [f64; 4]) -> String {
    let seed = format!(
        "{}|{}|{}|{}|{}|{}|{}",
        kind,
        page_index,
        source_ref,
        quantize(bbox[0]),
        quantize(bbox[1]),
        quantize(bbox[2]),
        quantize(bbox[3])
    );
    format!("{}_p{}_{}", kind, page_index, format!("{:016x}", fnv1a_64(&seed)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_object_id_is_deterministic() {
        let a = stable_object_id("text", 2, "page:2:content:15", [10.0, 20.0, 110.0, 44.0]);
        let b = stable_object_id("text", 2, "page:2:content:15", [10.0, 20.0, 110.0, 44.0]);
        assert_eq!(a, b);
        assert!(a.starts_with("text_p2_"));
    }

    #[test]
    fn stable_object_id_changes_with_geometry() {
        let a = stable_object_id("text", 2, "page:2:content:15", [10.0, 20.0, 110.0, 44.0]);
        let b = stable_object_id("text", 2, "page:2:content:15", [10.0, 21.0, 110.0, 44.0]);
        assert_ne!(a, b);
    }

    #[test]
    fn quantize_rounds_to_cents() {
        assert_eq!(quantize(10.123), 1012);
        assert_eq!(quantize(10.129), 1013);
    }

    #[test]
    fn fnv1a_64_is_deterministic() {
        assert_eq!(fnv1a_64("hello"), fnv1a_64("hello"));
    }
}
