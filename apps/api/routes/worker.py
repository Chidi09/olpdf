"""Worker routes — scheduled maintenance jobs triggered by QStash cron.

The OCR worker callback (ocr-complete) has been removed: scanned pages are
now processed inline via Gemini Vision in the import pipeline itself.
"""
import base64
import hashlib
import hmac
import os
from fastapi import APIRouter, HTTPException, Request
from ..cleanup_utils import cleanup_old_exports

router = APIRouter(prefix="/api/worker", tags=["worker"])


def _verify_qstash_signature(raw_body: bytes, signature: str | None) -> bool:
    signing_key = os.environ.get("QSTASH_CURRENT_SIGNING_KEY", "")
    if not signing_key:
        return os.environ.get("OLPDF_DEV_MODE") == "true"
    if not signature:
        return False
    digest = hmac.new(signing_key.encode(), raw_body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    return hmac.compare_digest(expected, signature)


def _require_qstash(request: Request, raw_body: bytes) -> None:
    if not _verify_qstash_signature(raw_body, request.headers.get("Upstash-Signature")):
        raise HTTPException(status_code=401, detail="Invalid QStash signature")


@router.post("/cleanup-exports")
async def worker_cleanup_exports(request: Request) -> dict:
    """QStash cron: delete expired export files from R2."""
    raw_body = await request.body()
    _require_qstash(request, raw_body)
    return cleanup_old_exports()
