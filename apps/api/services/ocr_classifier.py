"""Lightweight pre-scan classifier that recommends OCR strategy per page.

Uses PyMuPDF heuristics (no ML, no external calls) to decide whether a page
is safe for fast PaddleOCR or needs Gemini Vision for complex layouts.

Returns one of:
  - PADDLE_SIMPLE  → single-column text, clean layout → PaddleOCR is sufficient
  - GEMINI_FLASH   → tables, multi-column, figures, or low native confidence → Gemini 2.5 Flash
  - GEMINI_BATCH   → same as FLASH but signals the caller to batch pages for Gemini
"""
from __future__ import annotations

import logging
from enum import Enum
from typing import Any

import fitz  # PyMuPDF

logger = logging.getLogger("olpdf-api.ocr_classifier")


class OcrRoute(str, Enum):
    PADDLE_SIMPLE = "paddle_simple"
    GEMINI_FLASH = "gemini_flash"
    GEMINI_BATCH = "gemini_batch"


class PageClassification:
    route: OcrRoute
    confidence: float
    reason: str

    def __init__(self, route: OcrRoute, confidence: float, reason: str = ""):
        self.route = route
        self.confidence = confidence
        self.reason = reason or route.value


def _count_columns(words: list[list[float]], page_width: float) -> int:
    if not words:
        return 1
    x0s = sorted(w[0] for w in words)
    q1 = x0s[len(x0s) // 4]
    q3 = x0s[(3 * len(x0s)) // 4]
    left_ratio = sum(1 for x in x0s if x < page_width * 0.4) / max(len(x0s), 1)
    right_ratio = sum(1 for x in x0s if x > page_width * 0.6) / max(len(x0s), 1)
    if left_ratio > 0.3 and right_ratio > 0.3:
        return 2
    return 1


def _count_tables(page: fitz.Page) -> int:
    try:
        tabs = page.find_tables()
        if tabs:
            return len(tabs.tables)
    except Exception:
        pass
    return 0


def classify_page(page: fitz.Page, page_index: int, batch_threshold: int = 50) -> PageClassification:
    """Classify a single page for OCR routing.

    Args:
        page: PyMuPDF page object.
        page_index: Zero-based page index (used only for logging).
        batch_threshold: Pages at or above this index get GEMINI_BATCH route.

    Returns:
        PageClassification with recommended route.
    """
    pw = float(page.rect.width)
    ph = float(page.rect.height)
    page_area = pw * ph

    # ── Extract native text words ──────────────────────────────────────────
    text_page = page.get_text("words")
    n_words = len(text_page)

    # If rich, well-structured native text exists, no OCR needed at all.
    # But this classifier only runs for pages already flagged "needs OCR",
    # so we expect low word counts here.
    if n_words > 0:
        words_meta = [w[:4] for w in text_page]  # x0, y0, x1, y1 per word
    else:
        words_meta = []

    # ── Images ─────────────────────────────────────────────────────────────
    images = page.get_images(full=True)
    image_area = 0.0
    for img in images:
        try:
            iw = img[2] if isinstance(img[2], (int, float)) else 0
            ih = img[3] if isinstance(img[3], (int, float)) else 0
            image_area += iw * ih
        except Exception:
            pass
    # fallback: measure image display rects
    if not images:
        for draw_path in page.get_drawings():
            try:
                r = draw_path.get("rect")
                if r:
                    image_area += float(r.width) * float(r.height)
            except Exception:
                pass

    image_ratio = min(image_area / max(page_area, 1), 1.0)

    # ── Tables ─────────────────────────────────────────────────────────────
    n_tables = _count_tables(page)
    has_table = n_tables > 0

    # ── Columns ────────────────────────────────────────────────────────────
    n_columns = _count_columns(words_meta, pw)
    multi_column = n_columns > 1

    # ── Text coverage ──────────────────────────────────────────────────────
    text_coverage = n_words / max(page_area / 100, 1)  # words per 100 sq pt

    # ── Decision ───────────────────────────────────────────────────────────
    if batch_threshold is not None and page_index >= batch_threshold:
        return PageClassification(
            route=OcrRoute.GEMINI_BATCH,
            confidence=0.85,
            reason="page index exceeds batch threshold",
        )

    if multi_column or has_table:
        return PageClassification(
            route=OcrRoute.GEMINI_FLASH,
            confidence=0.85 if has_table else 0.75,
            reason=f"{'table' if has_table else 'multi-column'} layout detected",
        )

    if image_ratio > 0.4:
        return PageClassification(
            route=OcrRoute.GEMINI_FLASH,
            confidence=0.70,
            reason=f"image-heavy page (ratio={image_ratio:.2f})",
        )

    if text_coverage > 0.3:
        return PageClassification(
            route=OcrRoute.GEMINI_FLASH,
            confidence=0.80,
            reason=f"unexpected native text density ({text_coverage:.2f})",
        )

    return PageClassification(
        route=OcrRoute.PADDLE_SIMPLE,
        confidence=0.90,
        reason="simple layout, suitable for PaddleOCR",
    )


def classify_pages(
    pdf_bytes: bytes,
    page_indices: list[int],
    batch_threshold: int = 50,
) -> dict[str, list[PageClassification]]:
    """Classify multiple pages into PaddleOCR and Gemini buckets.

    Returns:
        dict with keys 'paddle_simple', 'gemini_flash', 'gemini_batch' mapping to
        lists of (page_index, classification) tuples grouped by route.
    """
    from collections import defaultdict

    buckets: dict[str, list[tuple[int, PageClassification]]] = defaultdict(list)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for idx in page_indices:
            if idx < 0 or idx >= len(doc):
                continue
            page = doc[idx]
            cl = classify_page(page, idx, batch_threshold=batch_threshold)
            buckets[cl.route.value].append((idx, cl))
    finally:
        doc.close()

    logger.info(
        "OCR classifier: %d paddle, %d gemini_flash, %d gemini_batch",
        len(buckets.get(OcrRoute.PADDLE_SIMPLE.value, [])),
        len(buckets.get(OcrRoute.GEMINI_FLASH.value, [])),
        len(buckets.get(OcrRoute.GEMINI_BATCH.value, [])),
    )
    return dict(buckets)
