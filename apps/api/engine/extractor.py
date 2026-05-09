"""PyMuPDF rich extraction pipeline -> DocumentModel blocks.

Uses page.get_text("dict") to capture the full span tree: font family, size,
bold, italic, color, line spacing, and alignment — everything needed for
Word-level editing fidelity in the FidelityCanvas.
"""

from collections import defaultdict
from typing import Any, Dict, List, Optional

import fitz


# ── Helpers ───────────────────────────────────────────────────────────────────

def _rgb_to_hex(srgb: int) -> str:
    """Convert PyMuPDF packed sRGB int to #rrggbb hex string."""
    r = (srgb >> 16) & 0xFF
    g = (srgb >> 8) & 0xFF
    b = srgb & 0xFF
    return f"#{r:02x}{g:02x}{b:02x}"


def _clean_font_name(raw: str) -> str:
    """Strip subset prefix (e.g. 'ABCDEF+TimesNewRoman' → 'TimesNewRoman')."""
    if "+" in raw:
        raw = raw.split("+", 1)[1]
    return raw.strip() or "Unknown"


def _detect_alignment(x0: float, x1: float, page_width: float) -> str:
    margin = page_width * 0.1
    centered_mid = page_width / 2
    block_mid = (x0 + x1) / 2
    if abs(block_mid - centered_mid) < page_width * 0.05:
        return "center"
    if x1 > page_width - margin and x0 < margin:
        return "justify"
    if x0 > page_width / 2:
        return "right"
    return "left"


def _infer_block_type(text: str, font_size: float, is_bold: bool, page_avg_size: float) -> str:
    stripped = text.strip()
    ratio = font_size / max(page_avg_size, 1.0)
    if ratio >= 1.8 or (ratio >= 1.4 and is_bold):
        return "heading1"
    if ratio >= 1.3 or (ratio >= 1.1 and is_bold):
        return "heading2"
    if ratio >= 1.1:
        return "heading3"
    if stripped and stripped[0] in ("-", "*", "•", "–", "○", "▪"):
        return "list"
    return "paragraph"


def _dominant_span(spans: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Return the span with the most characters — used for block-level metadata."""
    return max(spans, key=lambda s: len(s.get("text", "")), default={})


# ── Core extraction ───────────────────────────────────────────────────────────

def _extract_page_blocks(
    page: fitz.Page,
    page_index: int,
    page_avg_font_size: float,
) -> List[Dict[str, Any]]:
    """Extract all text blocks from a page with full font and layout metadata."""
    page_width = page.rect.width
    raw = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
    result_blocks: List[Dict[str, Any]] = []

    for block_idx, block in enumerate(raw.get("blocks", [])):
        if block.get("type") != 0:  # 0 = text block, 1 = image block
            continue

        lines = block.get("lines", [])
        if not lines:
            continue

        # Collect all spans across all lines in this block
        all_spans: List[Dict[str, Any]] = []
        for line in lines:
            all_spans.extend(line.get("spans", []))

        full_text = " ".join(s.get("text", "").strip() for s in all_spans if s.get("text", "").strip())
        if not full_text:
            continue

        # Use the dominant span for block-level font metadata
        dom = _dominant_span(all_spans)
        font_raw = dom.get("font", "Unknown")
        font_name = _clean_font_name(font_raw)
        font_size = float(dom.get("size", 11.0) or 11.0)
        font_flags = int(dom.get("flags", 0))
        is_bold = bool(font_flags & 2**4)     # bit 4 = bold
        is_italic = bool(font_flags & 2**1)   # bit 1 = italic
        color_int = int(dom.get("color", 0))
        color_hex = _rgb_to_hex(color_int)

        # Block bounding box
        bbox = block.get("bbox", [72, 72, 540, 86])
        x0, y0, x1, y1 = float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])

        # Line spacing: gap between consecutive line origins
        line_heights = []
        for i in range(1, len(lines)):
            prev_y = lines[i - 1]["bbox"][1]
            curr_y = lines[i]["bbox"][1]
            gap = curr_y - prev_y
            if gap > 0:
                line_heights.append(gap)
        line_height = round(sum(line_heights) / len(line_heights), 2) if line_heights else round(font_size * 1.2, 2)

        # Paragraph spacing: estimate from font size
        margin_top = round(font_size * 0.4, 2)
        margin_bottom = round(font_size * 0.4, 2)

        block_type = _infer_block_type(full_text, font_size, is_bold, page_avg_font_size)
        alignment = _detect_alignment(x0, x1, page_width)

        result_blocks.append({
            "id": f"blk_native_{page_index}_{block_idx}",
            "type": block_type,
            "content": full_text,
            "page_index": page_index,
            "bounding_box": [x0, y0, x1, y1],
            "font_meta": {
                "family": font_name,
                "size": round(font_size, 2),
                "is_bold": is_bold,
                "is_italic": is_italic,
                "color": color_hex,
            },
            "spacing": {
                "line_height": line_height,
                "margin_top": margin_top,
                "margin_bottom": margin_bottom,
            },
            "alignment": alignment,
            "column_index": 0,  # updated in Phase 7 (column detection)
            "confidence_score": 1.0,
            "needs_review": False,
            "style_overrides": {},
            "z_index": 0,
        })

    return result_blocks


def _compute_page_avg_font_size(page: fitz.Page) -> float:
    """Fast pass to compute average font size across the page for heading detection."""
    sizes: List[float] = []
    raw = page.get_text("dict", flags=0)
    for block in raw.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                s = float(span.get("size", 0) or 0)
                if s > 0:
                    sizes.append(s)
    return sum(sizes) / len(sizes) if sizes else 11.0


# ── Public API ────────────────────────────────────────────────────────────────

def extract_document_model_from_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    """Full document extraction. Returns block list + page_dimensions."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    blocks: List[Dict[str, Any]] = []
    page_dimensions: List[Dict[str, Any]] = []

    for page_index, page in enumerate(doc):
        rect = page.rect
        page_dimensions.append({
            "page_index": page_index,
            "width": float(rect.width),
            "height": float(rect.height),
        })
        avg_size = _compute_page_avg_font_size(page)
        page_blocks = _extract_page_blocks(page, page_index, avg_size)
        blocks.extend(page_blocks)

    doc.close()
    return {"blocks": blocks, "page_dimensions": page_dimensions}


def extract_page_blocks_from_pdf(pdf_bytes: bytes, page_index: int) -> List[Dict[str, Any]]:
    """Extract a single page. Used by import pipeline for native pages."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if page_index < 0 or page_index >= len(doc):
        doc.close()
        return []
    page = doc[page_index]
    avg_size = _compute_page_avg_font_size(page)
    result = _extract_page_blocks(page, page_index, avg_size)
    doc.close()
    return result
