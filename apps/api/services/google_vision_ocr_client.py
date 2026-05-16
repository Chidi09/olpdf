"""Google Cloud Vision OCR client.

Uses DOCUMENT_TEXT_DETECTION against rendered PDF page images and returns
blocks in the same schema as the existing OCR pipeline.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Any

import fitz  # PyMuPDF
import httpx

logger = logging.getLogger("olpdf-api.ocr.cloud_vision")

VISION_ENDPOINT = os.environ.get(
    "GOOGLE_CLOUD_VISION_ENDPOINT",
    "https://vision.googleapis.com/v1/images:annotate",
)
VISION_TIMEOUT_SECONDS = int(os.environ.get("GOOGLE_CLOUD_VISION_TIMEOUT", "120"))


def _render_page_png(pdf_bytes: bytes, page_index: int, scale: float = 2.0) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc[page_index]
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        return pix.tobytes("png")
    finally:
        doc.close()


def _text_from_word(word: dict[str, Any]) -> str:
    symbols = word.get("symbols") or []
    text = "".join(str(symbol.get("text", "")) for symbol in symbols)
    detected_break = (word.get("property") or {}).get("detectedBreak") or {}
    if not detected_break and symbols:
        detected_break = (symbols[-1].get("property") or {}).get("detectedBreak") or {}
    break_type = detected_break.get("type")
    if break_type in {"SPACE", "SURE_SPACE"}:
        text += " "
    elif break_type in {"EOL_SURE_SPACE", "LINE_BREAK"}:
        text += "\n"
    return text


def _layout_bbox(layout: dict[str, Any], width: float, height: float) -> list[float] | None:
    bbox = layout.get("boundingBox") or {}
    vertices = bbox.get("normalizedVertices") or []
    if not vertices:
        vertices = bbox.get("vertices") or []
        if not vertices:
            return None
        xs = [float(v.get("x", 0)) for v in vertices]
        ys = [float(v.get("y", 0)) for v in vertices]
    else:
        xs = [float(v.get("x", 0)) * width for v in vertices]
        ys = [float(v.get("y", 0)) * height for v in vertices]
    left, right = min(xs), max(xs)
    top, bottom = min(ys), max(ys)
    return [round(left, 3), round(top, 3), round(right - left, 3), round(bottom - top, 3)]


def vision_response_to_blocks(response: dict[str, Any], page_index: int) -> list[dict[str, Any]]:
    pages = (((response.get("responses") or [{}])[0]).get("fullTextAnnotation") or {}).get("pages") or []
    if not pages:
        text = (((response.get("responses") or [{}])[0]).get("fullTextAnnotation") or {}).get("text") or ""
        text = text.strip()
        if not text:
            return []
        return [{
            "id": f"blk_vision_{page_index}_0",
            "type": "paragraph",
            "content": text,
            "rich_spans": [],
            "page_index": page_index,
            "bounding_box": None,
            "confidence_score": 0.85,
            "needs_review": False,
            "style_overrides": {},
            "float": "none",
            "column_index": 0,
        }]

    blocks: list[dict[str, Any]] = []
    block_idx = 0
    for page in pages:
        width = float(page.get("width") or 1)
        height = float(page.get("height") or 1)
        for block in page.get("blocks") or []:
            for paragraph in block.get("paragraphs") or []:
                content = "".join(_text_from_word(word) for word in paragraph.get("words") or []).strip()
                if not content:
                    continue
                confidence = float(paragraph.get("confidence") or block.get("confidence") or 0.85)
                blocks.append({
                    "id": f"blk_vision_{page_index}_{block_idx}",
                    "type": "paragraph",
                    "content": content,
                    "rich_spans": [],
                    "page_index": page_index,
                    "bounding_box": _layout_bbox(paragraph, width, height),
                    "confidence_score": round(confidence, 3),
                    "needs_review": confidence < 0.80,
                    "style_overrides": {},
                    "float": "none",
                    "column_index": 0,
                })
                block_idx += 1
    return blocks


async def ocr_pages_with_cloud_vision(
    pdf_bytes: bytes,
    document_id: str,
    page_indices: list[int],
) -> list[dict[str, Any]]:
    api_key = os.environ.get("GOOGLE_CLOUD_VISION_API_KEY", "")
    if not api_key:
        logger.warning("GOOGLE_CLOUD_VISION_API_KEY not set; skipping Cloud Vision OCR")
        return []

    all_blocks: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=VISION_TIMEOUT_SECONDS) as client:
        for page_index in page_indices:
            png_bytes = _render_page_png(pdf_bytes, page_index)
            payload = {
                "requests": [{
                    "image": {"content": base64.b64encode(png_bytes).decode("ascii")},
                    "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                }]
            }
            response = await client.post(f"{VISION_ENDPOINT}?key={api_key}", json=payload)
            response.raise_for_status()
            blocks = vision_response_to_blocks(response.json(), page_index)
            logger.info(
                "Cloud Vision OCR document %s page %d -> %d blocks",
                document_id,
                page_index,
                len(blocks),
            )
            all_blocks.extend(blocks)
    return all_blocks
