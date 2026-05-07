"""PyMuPDF extraction pipeline -> DocumentModel blocks."""

from typing import Any, Dict, List

import fitz


def _word_to_block(word: List[Any], page_index: int, row_index: int) -> Dict[str, Any]:
    x0, y0, x1, y1, text, _block_no, _line_no, _word_no = word
    return {
        "id": f"blk_fitz_{page_index}_{row_index}",
        "type": "paragraph",
        "content": str(text).strip(),
        "confidence_score": 1.0,
        "needs_review": False,
        "bounding_box": [float(x0), float(y0), float(x1), float(y1)],
        "style_overrides": {},
        "page_index": page_index,
    }


def extract_document_model_from_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    blocks: List[Dict[str, Any]] = []
    page_dimensions: List[Dict[str, Any]] = []

    for page_index, page in enumerate(doc):
        rect = page.rect
        page_dimensions.append(
            {
                "page_index": page_index,
                "width": float(rect.width),
                "height": float(rect.height),
            }
        )
        words = page.get_text("words") or []
        for row_index, word in enumerate(words):
            block = _word_to_block(word, page_index, row_index)
            if block["content"]:
                blocks.append(block)

    return {
        "blocks": blocks,
        "page_dimensions": page_dimensions,
    }
