"""
Gemini Vision-based OCR.

Replaces the Modal/Surya/PaddleOCR external worker.
Renders each non-native page to a PNG and sends it to Gemini 2.5 Flash,
which returns a structured block list — same schema as native extraction.
All pages are processed concurrently via asyncio.gather + asyncio.to_thread.
"""
from __future__ import annotations

import asyncio
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


def _render_page_png(pdf_bytes_or_path: bytes | str, page_index: int, scale: float = 2.0) -> bytes:
    """Render a single PDF page to PNG bytes at 2× resolution for better OCR."""
    kwargs = {"filetype": "pdf"}
    if isinstance(pdf_bytes_or_path, str):
        kwargs["filename"] = pdf_bytes_or_path
    else:
        kwargs["stream"] = pdf_bytes_or_path
    doc = fitz.open(**kwargs)
    try:
        page = doc[page_index]
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        return pix.tobytes("png")
    finally:
        doc.close()


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


def _ocr_single_page_sync(
    pdf_bytes: bytes,
    page_idx: int,
    model: genai.GenerativeModel,
) -> List[Dict[str, Any]]:
    """Synchronous per-page OCR — run inside asyncio.to_thread."""
    try:
        png_bytes = _render_page_png(pdf_bytes, page_idx)
        response = model.generate_content(
            [_SYSTEM_PROMPT, {"mime_type": "image/png", "data": png_bytes}],
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        )
        raw = json.loads(response.text)
        if not isinstance(raw, list):
            raw = [raw]
        blocks = _raw_blocks_to_document_blocks(raw, page_idx)
        logger.info("Gemini OCR page %d → %d blocks", page_idx, len(blocks))
        return blocks
    except Exception as e:
        logger.error("Gemini OCR failed for page %d: %s", page_idx, e, exc_info=True)
        return [{
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
        }]


async def ocr_pages_with_gemini(
    pdf_bytes: bytes,
    page_indices: List[int],
    model_name: str = "gemini-2.5-flash",
    max_concurrency: int = 8,
) -> List[Dict[str, Any]]:
    """
    OCR given page indices via Gemini Vision. Uses a temp file for large PDFs
    so PyMuPDF lazy-loads from disk instead of holding the full blob in memory.
    Each page is rendered, sent to Gemini, released — never holding all pages at once.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — skipping Gemini OCR")
        return []

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)
    sem = asyncio.Semaphore(max_concurrency)

    source: bytes | str = pdf_bytes
    need_cleanup = False
    if len(pdf_bytes) > 50_000_000:
        import tempfile
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp.write(pdf_bytes)
        tmp.close()
        source = tmp.name
        need_cleanup = True

    async def _bounded(page_idx: int) -> List[Dict[str, Any]]:
        async with sem:
            return await asyncio.to_thread(_ocr_single_page_sync, source, page_idx, model)

    results = await asyncio.gather(*[_bounded(idx) for idx in page_indices])

    if need_cleanup:
        import os as _os
        _os.unlink(source)

    all_blocks = [block for page_blocks in results for block in page_blocks]
    all_blocks.sort(key=lambda b: (b.get("page_index", 0), b.get("id", "")))
    return all_blocks
