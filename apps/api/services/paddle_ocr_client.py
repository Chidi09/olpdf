"""Async HTTP client for the self-hosted PaddleOCR worker.

Sends PDF bytes + page indices to the OCR worker's synchronous endpoint
and returns normalised blocks in the same schema as Gemini OCR output.

Falls back to Gemini if the worker is unreachable (configurable via env var).
"""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger("olpdf-api.paddle_ocr_client")

OCR_WORKER_URL = os.environ.get("OCR_WORKER_URL", "").rstrip("/")
WORKER_SECRET = os.environ.get("WORKER_SECRET", "")
PADDLE_TIMEOUT_SECONDS = int(os.environ.get("OCR_PADDLE_TIMEOUT", "300"))  # 5 min for slow Paddle


async def ocr_pages_with_paddle(
    pdf_bytes: bytes,
    document_id: str,
    page_indices: list[int],
) -> list[dict[str, Any]]:
    """Send PDF bytes and page indices to the PaddleOCR worker synchronously.

    The worker renders the requested pages, runs PaddleOCR, and returns
    normalised blocks inline.

    Returns an empty list if the worker is unreachable (caller should fall back).
    """
    if not OCR_WORKER_URL:
        logger.warning("OCR_WORKER_URL not configured — skipping PaddleOCR")
        return []

    if not page_indices:
        return []

    url = f"{OCR_WORKER_URL}/worker/ocr-sync"
    headers = {
        "X-Worker-Secret": WORKER_SECRET,
    }

    # Send PDF as multipart upload — avoids base64 overhead on large PDFs
    import io
    import json

    try:
        pdf_file = io.BytesIO(pdf_bytes)
        files = {"pdf": ("document.pdf", pdf_file, "application/pdf")}
        data = {
            "document_id": document_id,
            "page_indices": json.dumps(page_indices),
        }
        async with httpx.AsyncClient(timeout=PADDLE_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, headers=headers, files=files, data=data)
        if resp.status_code == 200:
            result = resp.json()
            blocks = result.get("blocks", [])
            logger.info(
                "PaddleOCR returned %d blocks for document %s (%d pages)",
                len(blocks),
                document_id,
                len(page_indices),
            )
            return blocks
        elif resp.status_code == 401:
            logger.error("PaddleOCR worker rejected request: unauthorized")
            return []
        elif resp.status_code == 503:
            logger.warning("PaddleOCR worker returned unavailable — will fall back")
            return []
        else:
            logger.warning(
                "PaddleOCR worker returned HTTP %d for document %s",
                resp.status_code,
                document_id,
            )
            return []
    except httpx.TimeoutException:
        logger.error("PaddleOCR worker timed out for document %s (%d pages)", document_id, len(page_indices))
        return []
    except httpx.ConnectError:
        logger.warning("PaddleOCR worker unreachable for document %s — will fall back to Gemini", document_id)
        return []
    except Exception as exc:
        logger.error(
            "PaddleOCR client error for document %s: %s",
            document_id,
            exc,
            exc_info=True,
        )
        return []


async def is_paddle_worker_alive() -> bool:
    """Quick health check — returns True if the PaddleOCR worker is reachable."""
    if not OCR_WORKER_URL:
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{OCR_WORKER_URL}/health")
        return resp.status_code == 200
    except Exception:
        return False
