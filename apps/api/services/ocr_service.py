"""
Gemini Vision-based OCR.

Replaces the Modal/Surya/PaddleOCR external worker.
Renders each non-native page to a PNG and sends it to Gemini 2.5 Flash,
which returns a structured block list — same schema as native extraction.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List

import fitz  # PyMuPDF
import google.generativeai as genai

logger = logging.getLogger("olpdf-api.ocr")

_SYSTEM_PROMPT = """You are a document layout extractor. Given an image of a PDF page, extract ALL text content and return it as a JSON array of blocks.

Each block must follow this exact schema:
{
  "type": "heading1" | "heading2" | "heading3" | "paragraph" | "list" | "table" | "caption" | "callout",
  "content": "<full text of this block>",
  "confidence": 0.0-1.0
}

Rules:
- Preserve reading order: top-to-bottom, left-to-right (handle multi-column correctly)
- Infer type from visual cues: large/bold text = heading, bullet/numbered = list, grid = table
- For tables: render as markdown table format (| col | col |) in the content field
- For lists: include the bullet/number prefix in content
- Return ONLY valid JSON — no commentary, no markdown code fences
- If a region is illegible, include it with confidence < 0.5 and content = "[illegible]"
"""


def _render_page_png(pdf_bytes: bytes, page_index: int, scale: float = 2.0) -> bytes:
    """Render a single PDF page to PNG bytes at 2× resolution for better OCR."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[page_index]
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return pix.tobytes("png")


def _raw_blocks_to_document_blocks(
    raw: List[Dict[str, Any]],
    page_index: int,
) -> List[Dict[str, Any]]:
    """Convert Gemini's output into DocumentBlock-compatible dicts."""
    import os as _os
    blocks = []
    for i, b in enumerate(raw):
        block_type = b.get("type", "paragraph")
        if block_type not in {
            "heading1", "heading2", "heading3",
            "paragraph", "list", "table",
            "caption", "callout", "divider",
        }:
            block_type = "paragraph"

        confidence = float(b.get("confidence", 0.85))
        content = str(b.get("content", "")).strip()

        blocks.append({
            "id": f"blk_ocr_{page_index}_{i}_{_os.urandom(2).hex()}",
            "type": block_type,
            "content": content,
            "rich_spans": [],
            "page_index": page_index,
            "bounding_box": None,
            "confidence_score": round(confidence, 3),
            "needs_review": confidence < 0.80,
            "style_overrides": {},
            "float": "none",
            "column_index": 0,
        })
    return blocks


async def ocr_pages_with_gemini(
    pdf_bytes: bytes,
    page_indices: List[int],
    model_name: str = "gemini-2.5-flash",
) -> List[Dict[str, Any]]:
    """
    OCR a list of page indices from a PDF using Gemini Vision.
    Returns a flat list of DocumentBlock dicts in page order.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — skipping Gemini OCR, pages will be empty")
        return []

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)

    all_blocks: List[Dict[str, Any]] = []

    for page_idx in page_indices:
        try:
            png_bytes = _render_page_png(pdf_bytes, page_idx)

            response = model.generate_content(
                [
                    _SYSTEM_PROMPT,
                    {"mime_type": "image/png", "data": png_bytes},
                ],
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.1,  # low temp for factual extraction
                },
            )

            raw = json.loads(response.text)
            if not isinstance(raw, list):
                raw = [raw]

            page_blocks = _raw_blocks_to_document_blocks(raw, page_idx)
            all_blocks.extend(page_blocks)
            logger.info(
                "Gemini OCR page %d → %d blocks (model=%s)",
                page_idx, len(page_blocks), model_name,
            )

        except Exception as e:
            logger.error("Gemini OCR failed for page %d: %s", page_idx, e, exc_info=True)
            # Insert a placeholder block so the page isn't silently lost
            all_blocks.append({
                "id": f"blk_ocr_{page_idx}_err",
                "type": "paragraph",
                "content": f"[OCR failed for page {page_idx + 1}]",
                "rich_spans": [],
                "page_index": page_idx,
                "bounding_box": None,
                "confidence_score": 0.0,
                "needs_review": True,
                "style_overrides": {},
                "float": "none",
                "column_index": 0,
            })

    return all_blocks
