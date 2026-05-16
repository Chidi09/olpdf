"""
Smart OCR dispatcher and Gemini Vision-based OCR backend.

Routes pages to the optimal OCR engine based on layout classification:
  - Simple single-column pages → PaddleOCR (fast, cheap)
  - Tables / multi-column / complex layouts → Gemini 2.5 Flash (accurate)
  - Pages beyond batch threshold → Gemini batch mode (concurrent)

Falls back gracefully if PaddleOCR worker is unreachable.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import fitz  # PyMuPDF
import google.generativeai as genai

from .ocr_classifier import OcrRoute, classify_pages
from .paddle_ocr_client import ocr_pages_with_paddle, is_paddle_worker_alive

logger = logging.getLogger("olpdf-api.ocr")

# Tunable thresholds (override via env)
_CONFIDENCE_THRESHOLD = float(os.environ.get("OCR_CONFIDENCE_THRESHOLD", "0.85"))
_BATCH_PAGE_THRESHOLD = int(os.environ.get("OCR_BATCH_PAGE_THRESHOLD", "50"))
_MAX_CONCURRENCY = int(os.environ.get("OCR_GEMINI_MAX_CONCURRENCY", "8"))

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


async def _ocr_pages_gemini(
    pdf_bytes: bytes,
    page_indices: list[int],
    model_name: str = "gemini-2.5-flash",
    max_concurrency: int | None = None,
) -> list[dict[str, Any]]:
    """
    OCR given page indices via Gemini Vision. Uses a temp file for large PDFs
    so PyMuPDF lazy-loads from disk instead of holding the full blob in memory.
    Each page is rendered, sent to Gemini, released — never holding all pages at once.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — skipping Gemini OCR")
        return []

    if not page_indices:
        return []

    concurrency = max_concurrency or _MAX_CONCURRENCY
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)
    sem = asyncio.Semaphore(concurrency)

    source: bytes | str = pdf_bytes
    need_cleanup = False
    if len(pdf_bytes) > 50_000_000:
        import tempfile
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp.write(pdf_bytes)
        tmp.close()
        source = tmp.name
        need_cleanup = True

    async def _bounded(page_idx: int) -> list[dict[str, Any]]:
        async with sem:
            return await asyncio.to_thread(_ocr_single_page_sync, source, page_idx, model)

    results = await asyncio.gather(*[_bounded(idx) for idx in page_indices])

    if need_cleanup:
        import os as _os
        _os.unlink(source)

    all_blocks = [block for page_blocks in results for block in page_blocks]
    all_blocks.sort(key=lambda b: (b.get("page_index", 0), b.get("id", "")))
    return all_blocks


async def ocr_document(
    pdf_bytes: bytes,
    document_id: str,
    page_indices: list[int],
) -> list[dict[str, Any]]:
    """Smart OCR dispatcher.

    Classifies pages by layout and routes them to the optimal engine:
      - PaddleOCR for simple single-column pages
      - Gemini Flash for complex layouts (tables, multi-column, image-heavy)
      - Gemini Batch for pages beyond the batch threshold

    Falls back to Gemini for all pages if PaddleOCR worker is unreachable.
    """
    if not page_indices:
        return []

    # Classify pages into routing buckets
    buckets = classify_pages(
        pdf_bytes,
        page_indices,
        batch_threshold=_BATCH_PAGE_THRESHOLD,
    )

    paddle_indices = [idx for idx, _ in buckets.get(OcrRoute.PADDLE_SIMPLE.value, [])]
    gemini_flash_indices = [idx for idx, _ in buckets.get(OcrRoute.GEMINI_FLASH.value, [])]
    gemini_batch_indices = [idx for idx, _ in buckets.get(OcrRoute.GEMINI_BATCH.value, [])]

    # Determine if Paddle worker is reachable
    paddle_alive = False
    if paddle_indices:
        paddle_alive = await is_paddle_worker_alive()
        if not paddle_alive:
            logger.warning(
                "PaddleOCR worker unreachable — rerouting %d pages to Gemini Flash",
                len(paddle_indices),
            )
            gemini_flash_indices.extend(paddle_indices)
            paddle_indices = []

    # Run OCR engines concurrently
    paddle_task = None
    gemini_flash_task = None
    gemini_batch_task = None

    if paddle_indices and paddle_alive:
        paddle_task = asyncio.create_task(
            ocr_pages_with_paddle(pdf_bytes, document_id, paddle_indices)
        )

    if gemini_flash_indices:
        gemini_flash_task = asyncio.create_task(
            _ocr_pages_gemini(pdf_bytes, gemini_flash_indices, model_name="gemini-2.5-flash")
        )

    if gemini_batch_indices:
        gemini_batch_task = asyncio.create_task(
            _ocr_pages_gemini(pdf_bytes, gemini_batch_indices, model_name="gemini-2.5-flash")
        )

    results = await asyncio.gather(
        *(t for t in [paddle_task, gemini_flash_task, gemini_batch_task] if t is not None),
    )

    all_blocks: list[dict[str, Any]] = []
    for r in results:
        if r:
            all_blocks.extend(r)

    # If PaddleOCR returned nothing (background processing), we may have zero blocks
    # for those pages. The caller handles this by marking status as "partial".
    if not all_blocks and (gemini_flash_indices or gemini_batch_indices):
        logger.warning(
            "OCR document %s produced no blocks — all engines returned empty",
            document_id,
        )

    all_blocks.sort(key=lambda b: (b.get("page_index", 0), b.get("id", "")))
    return all_blocks
