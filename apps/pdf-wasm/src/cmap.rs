use std::collections::HashMap;

// ── Standard PDF encoding tables ─────────────────────────────────────────
//
// These cover PDFs that use /WinAnsiEncoding, /MacRomanEncoding, or
// /PDFDocEncoding without embedding a ToUnicode CMap.  Index = byte value.

pub(crate) static WINANSI: [u32; 256] = [
    0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,  // 0x00-0x0F
    0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,  // 0x10-0x1F
    0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x27, // 0x20-0x27
    0x28,0x29,0x2A,0x2B,0x2C,0x2D,0x2E,0x2F, // 0x28-0x2F
    0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37, // 0x30-0x37
    0x38,0x39,0x3A,0x3B,0x3C,0x3D,0x3E,0x3F, // 0x38-0x3F
    0x40,0x41,0x42,0x43,0x44,0x45,0x46,0x47, // 0x40-0x47
    0x48,0x49,0x4A,0x4B,0x4C,0x4D,0x4E,0x4F, // 0x48-0x4F
    0x50,0x51,0x52,0x53,0x54,0x55,0x56,0x57, // 0x50-0x57
    0x58,0x59,0x5A,0x5B,0x5C,0x5D,0x5E,0x5F, // 0x58-0x5F
    0x60,0x61,0x62,0x63,0x64,0x65,0x66,0x67, // 0x60-0x67
    0x68,0x69,0x6A,0x6B,0x6C,0x6D,0x6E,0x6F, // 0x68-0x6F
    0x70,0x71,0x72,0x73,0x74,0x75,0x76,0x77, // 0x70-0x77
    0x78,0x79,0x7A,0x7B,0x7C,0x7D,0x7E,0,   // 0x78-0x7F
    // 0x80-0x9F (WinAnsi extras, CP1252)
    0x20AC,0,0x201A,0x0192,0x201E,0x2026,0x2020,0x2021,
    0x02C6,0x2030,0x0160,0x2039,0x0152,0,0x017D,0,
    0,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,
    0x02DC,0x2122,0x0161,0x203A,0x0153,0,0x017E,0x0178,
    // 0xA0-0xFF (Latin-1 supplement)
    0xA0,0xA1,0xA2,0xA3,0xA4,0xA5,0xA6,0xA7,
    0xA8,0xA9,0xAA,0xAB,0xAC,0xAD,0xAE,0xAF,
    0xB0,0xB1,0xB2,0xB3,0xB4,0xB5,0xB6,0xB7,
    0xB8,0xB9,0xBA,0xBB,0xBC,0xBD,0xBE,0xBF,
    0xC0,0xC1,0xC2,0xC3,0xC4,0xC5,0xC6,0xC7,
    0xC8,0xC9,0xCA,0xCB,0xCC,0xCD,0xCE,0xCF,
    0xD0,0xD1,0xD2,0xD3,0xD4,0xD5,0xD6,0xD7,
    0xD8,0xD9,0xDA,0xDB,0xDC,0xDD,0xDE,0xDF,
    0xE0,0xE1,0xE2,0xE3,0xE4,0xE5,0xE6,0xE7,
    0xE8,0xE9,0xEA,0xEB,0xEC,0xED,0xEE,0xEF,
    0xF0,0xF1,0xF2,0xF3,0xF4,0xF5,0xF6,0xF7,
    0xF8,0xF9,0xFA,0xFB,0xFC,0xFD,0xFE,0xFF,
];

pub(crate) static MACROMAN: [u32; 256] = [
    0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,
    // 0x20-0x7E: same as ASCII
    0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x27,
    0x28,0x29,0x2A,0x2B,0x2C,0x2D,0x2E,0x2F,
    0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,
    0x38,0x39,0x3A,0x3B,0x3C,0x3D,0x3E,0x3F,
    0x40,0x41,0x42,0x43,0x44,0x45,0x46,0x47,
    0x48,0x49,0x4A,0x4B,0x4C,0x4D,0x4E,0x4F,
    0x50,0x51,0x52,0x53,0x54,0x55,0x56,0x57,
    0x58,0x59,0x5A,0x5B,0x5C,0x5D,0x5E,0x5F,
    0x60,0x61,0x62,0x63,0x64,0x65,0x66,0x67,
    0x68,0x69,0x6A,0x6B,0x6C,0x6D,0x6E,0x6F,
    0x70,0x71,0x72,0x73,0x74,0x75,0x76,0x77,
    0x78,0x79,0x7A,0x7B,0x7C,0x7D,0x7E,0,
    // 0x80-0xFF MacRoman upper half
    0xC4,0xC5,0xC7,0xC9,0xD1,0xD6,0xDC,0xE1,
    0xE0,0xE2,0xE4,0xE5,0xE7,0xE9,0xE8,0xEA,
    0xEB,0xED,0xEC,0xEE,0xEF,0xF1,0xF3,0xF2,
    0xF4,0xF6,0xFA,0xF9,0xFB,0xFC,0x2020,0xB0,
    0xA2,0xA3,0xA7,0x2022,0xB6,0xDF,0xAE,0xA9,
    0x2122,0xB4,0xA8,0x2260,0xC6,0xD8,0x221E,0xB1,
    0x2264,0x2265,0xA5,0xB5,0x2202,0x2211,0x220F,0x3C0,
    0x222B,0xAA,0xBA,0x3A9,0xE6,0xF8,0xBF,0xA1,
    0xAC,0x221A,0x192,0x2248,0x2206,0xAB,0xBB,0x2026,
    0xA0,0xC0,0xC3,0xD5,0x152,0x153,0x2013,0x2014,
    0x201C,0x201D,0x2018,0x2019,0xF7,0x25CA,0xFF,0x178,
    0x2044,0x20AC,0x2039,0x203A,0xFB01,0xFB02,0x2021,0xB7,
    0x201A,0x201E,0x2030,0xC2,0xCA,0xC1,0xCB,0xC8,
    0xCD,0xCE,0xCF,0xCC,0xD3,0xD4,0xF8FF,0xD2,
    0xDA,0xDB,0xD9,0x131,0x2C6,0x2DC,0xAF,0x2D8,
    0x2D9,0x2DA,0xB8,0x2DD,0x2DB,0x2C7,0,0,
];

/// Glyph name → Unicode codepoint for the Adobe Glyph List (subset covering
/// the most common names seen in PDF /Differences arrays).
pub fn glyph_name_to_unicode(name: &str) -> Option<char> {
    // Strip variant suffix like "A.sc", "one.oldstyle"
    let base = name.split('.').next().unwrap_or(name);
    // uniXXXX or uXXXX forms
    if base.starts_with("uni") && base.len() == 7 {
        if let Ok(cp) = u32::from_str_radix(&base[3..], 16) {
            return char::from_u32(cp);
        }
    }
    if base.starts_with('u') && base.len() >= 5 && base.len() <= 7 {
        if let Ok(cp) = u32::from_str_radix(&base[1..], 16) {
            return char::from_u32(cp);
        }
    }
    // Common named glyphs (AGL subset)
    let cp: u32 = match base {
        "space" => 0x0020, "exclam" => 0x0021, "quotedbl" => 0x0022,
        "numbersign" => 0x0023, "dollar" => 0x0024, "percent" => 0x0025,
        "ampersand" => 0x0026, "quotesingle" => 0x0027, "parenleft" => 0x0028,
        "parenright" => 0x0029, "asterisk" => 0x002A, "plus" => 0x002B,
        "comma" => 0x002C, "hyphen" => 0x002D, "period" => 0x002E,
        "slash" => 0x002F, "colon" => 0x003A, "semicolon" => 0x003B,
        "less" => 0x003C, "equal" => 0x003D, "greater" => 0x003E,
        "question" => 0x003F, "at" => 0x0040, "bracketleft" => 0x005B,
        "backslash" => 0x005C, "bracketright" => 0x005D, "asciicircum" => 0x005E,
        "underscore" => 0x005F, "grave" => 0x0060, "braceleft" => 0x007B,
        "bar" => 0x007C, "braceright" => 0x007D, "asciitilde" => 0x007E,
        "endash" => 0x2013, "emdash" => 0x2014,
        "quotedblleft" => 0x201C, "quotedblright" => 0x201D,
        "quoteleft" => 0x2018, "quoteright" => 0x2019,
        "quotesinglbase" => 0x201A, "quotedblbase" => 0x201E,
        "ellipsis" => 0x2026, "dagger" => 0x2020, "daggerdbl" => 0x2021,
        "bullet" => 0x2022, "perthousand" => 0x2030,
        "guilsinglleft" => 0x2039, "guilsinglright" => 0x203A,
        "guillemotleft" => 0x00AB, "guillemotright" => 0x00BB,
        "fi" => 0xFB01, "fl" => 0xFB02,
        "florin" => 0x0192, "fraction" => 0x2044,
        "Euro" => 0x20AC, "trademark" => 0x2122,
        "minus" => 0x2212, "multiply" => 0x00D7, "divide" => 0x00F7,
        "infinity" => 0x221E, "radical" => 0x221A,
        "summation" => 0x2211, "product" => 0x220F, "integral" => 0x222B,
        "partialdiff" => 0x2202, "Delta" => 0x2206,
        "Omega" => 0x03A9, "pi" => 0x03C0, "mu" => 0x00B5,
        "nbspace" => 0x00A0, "softhyphen" => 0x00AD,
        "copyright" => 0x00A9, "registered" => 0x00AE,
        "degree" => 0x00B0, "plusminus" => 0x00B1,
        "onesuperior" => 0x00B9, "twosuperior" => 0x00B2, "threesuperior" => 0x00B3,
        "onequarter" => 0x00BC, "onehalf" => 0x00BD, "threequarters" => 0x00BE,
        "Agrave" => 0x00C0, "Aacute" => 0x00C1, "Acircumflex" => 0x00C2,
        "Atilde" => 0x00C3, "Adieresis" => 0x00C4, "Aring" => 0x00C5,
        "AE" => 0x00C6, "Ccedilla" => 0x00C7, "Egrave" => 0x00C8,
        "Eacute" => 0x00C9, "Ecircumflex" => 0x00CA, "Edieresis" => 0x00CB,
        "Igrave" => 0x00CC, "Iacute" => 0x00CD, "Icircumflex" => 0x00CE,
        "Idieresis" => 0x00CF, "Eth" => 0x00D0, "Ntilde" => 0x00D1,
        "Ograve" => 0x00D2, "Oacute" => 0x00D3, "Ocircumflex" => 0x00D4,
        "Otilde" => 0x00D5, "Odieresis" => 0x00D6, "Oslash" => 0x00D8,
        "Ugrave" => 0x00D9, "Uacute" => 0x00DA, "Ucircumflex" => 0x00DB,
        "Udieresis" => 0x00DC, "Yacute" => 0x00DD, "Thorn" => 0x00DE,
        "germandbls" => 0x00DF,
        "agrave" => 0x00E0, "aacute" => 0x00E1, "acircumflex" => 0x00E2,
        "atilde" => 0x00E3, "adieresis" => 0x00E4, "aring" => 0x00E5,
        "ae" => 0x00E6, "ccedilla" => 0x00E7, "egrave" => 0x00E8,
        "eacute" => 0x00E9, "ecircumflex" => 0x00EA, "edieresis" => 0x00EB,
        "igrave" => 0x00EC, "iacute" => 0x00ED, "icircumflex" => 0x00EE,
        "idieresis" => 0x00EF, "eth" => 0x00F0, "ntilde" => 0x00F1,
        "ograve" => 0x00F2, "oacute" => 0x00F3, "ocircumflex" => 0x00F4,
        "otilde" => 0x00F5, "odieresis" => 0x00F6, "oslash" => 0x00F8,
        "ugrave" => 0x00F9, "uacute" => 0x00FA, "ucircumflex" => 0x00FB,
        "udieresis" => 0x00FC, "yacute" => 0x00FD, "thorn" => 0x00FE,
        "ydieresis" => 0x00FF,
        "dotlessi" => 0x0131, "Lslash" => 0x0141, "lslash" => 0x0142,
        "OE" => 0x0152, "oe" => 0x0153,
        "Scaron" => 0x0160, "scaron" => 0x0161,
        "Ydieresis" => 0x0178, "Zcaron" => 0x017D, "zcaron" => 0x017E,
        "breve" => 0x02D8, "dotaccent" => 0x02D9, "ring" => 0x02DA,
        "ogonek" => 0x02DB, "tilde" => 0x02DC, "hungarumlaut" => 0x02DD,
        "caron" => 0x02C7, "circumflex" => 0x02C6,
        "macron" => 0x00AF, "cedilla" => 0x00B8, "dieresis" => 0x00A8,
        "acute" => 0x00B4,
        // digits / alpha: single-char names fall through to the char() check below
        _ => 0,
    };
    if cp != 0 {
        return char::from_u32(cp);
    }
    // Single-letter/digit glyph names ("A".."Z", "a".."z", "zero".."nine")
    let digit_names = ["zero","one","two","three","four","five","six","seven","eight","nine"];
    if let Some(pos) = digit_names.iter().position(|&n| n == base) {
        return char::from_u32(0x30 + pos as u32);
    }
    let mut chars = base.chars();
    if let (Some(c), None) = (chars.next(), chars.next()) {
        if c.is_alphabetic() { return Some(c); }
    }
    None
}

// ── CMap parsing ──────────────────────────────────────────────────────────

/// Returns (unicode_map, is_two_byte).
/// `is_two_byte` is true when `begincodespacerange` declares 2-byte codes,
/// meaning callers must decode bytes in pairs instead of one-by-one.
pub fn parse_cmap(data: &[u8]) -> (HashMap<u16, char>, bool) {
    let s = String::from_utf8_lossy(data);
    let mut map = HashMap::new();
    let mut is_two_byte = false;
    let mut in_bfchar = false;
    let mut in_bfrange = false;
    let mut in_codespace = false;

    for line in s.lines() {
        let trimmed = line.trim();

        // ── codespacerange: detect 2-byte codes ──────────────────────────
        if trimmed.starts_with("begincodespacerange") { in_codespace = true; continue; }
        if trimmed.starts_with("endcodespacerange")   { in_codespace = false; continue; }
        if in_codespace {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 2 {
                let hi_hex = parts[1].trim_start_matches('<').trim_end_matches('>');
                if hi_hex.len() >= 4 { is_two_byte = true; }
            }
            continue;
        }

        // ── section markers ──────────────────────────────────────────────
        if trimmed.starts_with("beginbfchar")  { in_bfchar = true;  in_bfrange = false; continue; }
        if trimmed.starts_with("endbfchar")    { in_bfchar = false; continue; }
        if trimmed.starts_with("beginbfrange") { in_bfrange = true; in_bfchar = false; continue; }
        if trimmed.starts_with("endbfrange")   { in_bfrange = false; continue; }

        // ── bfchar ───────────────────────────────────────────────────────
        if in_bfchar {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 2 {
                let src = hex_to_u16(parts[0]);
                let ch = parse_cmap_char(parts[1]);
                if ch != '\0' { map.insert(src, ch); }
            }
        }

        // ── bfrange ───────────────────────────────────────────────────────
        if in_bfrange {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() < 3 { continue; }
            let lo = hex_to_u16(parts[0]);
            let hi = hex_to_u16(parts[1]);
            let dst = parts[2];

            if dst.starts_with('[') {
                // Array form: <lo> <hi> [<u1> <u2> ... <un>]
                // Collect all the angle-bracket tokens from this line
                let array_str = trimmed[trimmed.find('[').unwrap_or(0)..].trim();
                let tokens: Vec<&str> = array_str
                    .trim_start_matches('[')
                    .trim_end_matches(']')
                    .split_whitespace()
                    .collect();
                for (i, token) in tokens.iter().enumerate() {
                    let c = hex_to_u16(token);
                    let src = lo.saturating_add(i as u16);
                    if src > hi { break; }
                    if let Some(ch) = char::from_u32(c as u32) {
                        if ch != '\0' { map.insert(src, ch); }
                    }
                }
            } else if dst.starts_with('<') {
                // Scalar form: sequential mapping from base Unicode codepoint
                let base = parse_cmap_char(dst);
                let base_cp = base as u32;
                for (i, c) in (lo..=hi).enumerate() {
                    if let Some(ch) = char::from_u32(base_cp + i as u32) {
                        if ch != '\0' { map.insert(c, ch); }
                    }
                }
            } else {
                // Decimal literal base (rare)
                if let Ok(base) = dst.parse::<u32>() {
                    for (i, c) in (lo..=hi).enumerate() {
                        if let Some(ch) = char::from_u32(base + i as u32) {
                            if ch != '\0' { map.insert(c, ch); }
                        }
                    }
                }
            }
        }
    }

    (map, is_two_byte)
}

fn hex_to_u16(s: &str) -> u16 {
    let hex = s.trim_start_matches('<').trim_end_matches('>');
    u16::from_str_radix(hex, 16).unwrap_or(0)
}

pub fn parse_cmap_char(s: &str) -> char {
    let hex = s.trim_start_matches('<').trim_end_matches('>');
    if hex.len() <= 4 {
        let code = u32::from_str_radix(hex, 16).unwrap_or(0);
        char::from_u32(code).unwrap_or('\u{FFFD}')
    } else {
        // Multi-byte UTF-16: decode surrogate pairs
        let words: Vec<u16> = (0..hex.len())
            .step_by(4)
            .filter_map(|i| {
                if i + 4 <= hex.len() {
                    u16::from_str_radix(&hex[i..i + 4], 16).ok()
                } else {
                    None
                }
            })
            .collect();
        String::from_utf16_lossy(&words)
            .chars()
            .next()
            .unwrap_or('\u{FFFD}')
    }
}

// ── Decoding ──────────────────────────────────────────────────────────────

pub enum EncodingFallback {
    WinAnsi,
    MacRoman,
    /// Custom Differences-array map: byte → Unicode
    Custom(HashMap<u8, char>),
}

/// Decode a raw byte string from a PDF text operator.
///
/// Priority:
///   1. UTF-16 BOM (always overrides everything)
///   2. ToUnicode CMap (1-byte or 2-byte codes depending on `is_two_byte`)
///   3. `encoding_fallback` (standard encoding or /Differences)
///   4. Raw ASCII graphic passthrough
pub fn decode_bytes(
    bytes: &[u8],
    unicode_map: &HashMap<u16, char>,
    is_two_byte: bool,
    encoding_fallback: Option<&EncodingFallback>,
    unmapped_chars: &mut usize,
) -> String {
    // 1. UTF-16 BOM
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        let words: Vec<u16> = bytes[2..]
            .chunks(2)
            .filter(|c| c.len() == 2)
            .map(|c| ((c[0] as u16) << 8) | (c[1] as u16))
            .collect();
        return String::from_utf16_lossy(&words);
    }

    // 2. ToUnicode CMap
    if !unicode_map.is_empty() {
        if is_two_byte {
            // 2-byte CID codes
            return bytes
                .chunks(2)
                .map(|chunk| {
                    let code: u16 = if chunk.len() == 2 {
                        ((chunk[0] as u16) << 8) | (chunk[1] as u16)
                    } else {
                        chunk[0] as u16
                    };
                    unicode_map.get(&code).copied().unwrap_or_else(|| {
                        *unmapped_chars += 1;
                        '\u{FFFD}'
                    })
                })
                .collect();
        } else {
            // 1-byte codes
            return bytes
                .iter()
                .map(|&b| {
                    unicode_map.get(&(b as u16)).copied().unwrap_or_else(|| {
                        if b.is_ascii_graphic() || b == b' ' {
                            b as char
                        } else {
                            *unmapped_chars += 1;
                            '\u{FFFD}'
                        }
                    })
                })
                .collect();
        }
    }

    // 3. Standard encoding fallback
    if let Some(fallback) = encoding_fallback {
        return bytes
            .iter()
            .map(|&b| match fallback {
                EncodingFallback::WinAnsi => {
                    char::from_u32(WINANSI[b as usize]).unwrap_or('\u{FFFD}')
                }
                EncodingFallback::MacRoman => {
                    char::from_u32(MACROMAN[b as usize]).unwrap_or('\u{FFFD}')
                }
                EncodingFallback::Custom(m) => {
                    m.get(&b).copied().unwrap_or_else(|| {
                        if b.is_ascii_graphic() || b == b' ' { b as char } else { '\u{FFFD}' }
                    })
                }
            })
            .collect();
    }

    // 4. ASCII passthrough
    bytes
        .iter()
        .map(|&b| {
            if b.is_ascii_graphic() || b == b' ' {
                b as char
            } else {
                *unmapped_chars += 1;
                '\u{FFFD}'
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bfchar_basic() {
        let cmap = b"beginbfchar\n<41> <0041>\nendbfchar\n";
        let (map, two_byte) = parse_cmap(cmap);
        assert_eq!(map.get(&0x41), Some(&'A'));
        assert!(!two_byte);
    }

    #[test]
    fn bfrange_scalar() {
        let cmap = b"beginbfrange\n<41> <43> <0041>\nendbfrange\n";
        let (map, _) = parse_cmap(cmap);
        assert_eq!(map.get(&0x41), Some(&'A'));
        assert_eq!(map.get(&0x42), Some(&'B'));
        assert_eq!(map.get(&0x43), Some(&'C'));
    }

    #[test]
    fn bfrange_array_form() {
        let cmap = b"beginbfrange\n<0020> <0022> [<0041> <0042> <0043>]\nendbfrange\n";
        let (map, _) = parse_cmap(cmap);
        assert_eq!(map.get(&0x0020), Some(&'A'));
        assert_eq!(map.get(&0x0021), Some(&'B'));
        assert_eq!(map.get(&0x0022), Some(&'C'));
    }

    #[test]
    fn two_byte_detected_via_codespacerange() {
        let cmap = b"begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n";
        let (_, two_byte) = parse_cmap(cmap);
        assert!(two_byte);
    }

    #[test]
    fn winansi_euro_sign() {
        assert_eq!(WINANSI[0x80], 0x20AC);
    }

    #[test]
    fn glyph_name_endash() {
        assert_eq!(glyph_name_to_unicode("endash"), Some('\u{2013}'));
    }

    #[test]
    fn glyph_name_uni_form() {
        assert_eq!(glyph_name_to_unicode("uni0041"), Some('A'));
    }
}
