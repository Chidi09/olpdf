"""
Cryptographic redaction — content is permanently removed from the PDF byte stream,
not merely obscured with a visual overlay.
"""
import io
from typing import Any, Dict, List

import fitz


def apply_true_redaction(pdf_bytes: bytes, areas: List[Dict[str, Any]]) -> bytes:
    """
    areas: [{"page": int, "bbox": [x0, y0, x1, y1]}, ...]
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for raw_area in areas:
        area = raw_area.model_dump() if hasattr(raw_area, "model_dump") else raw_area
        page_idx = area.get("page", area.get("page_number", 0))
        bbox = area.get("bbox")
        if page_idx < len(doc) and bbox and len(bbox) == 4:
            doc[page_idx].add_redact_annot(bbox, fill=(0, 0, 0))

    for page in doc:
        page.apply_redactions()
    buf = io.BytesIO()
    doc.save(buf, garbage=4, deflate=True)
    doc.close()
    return buf.getvalue()
