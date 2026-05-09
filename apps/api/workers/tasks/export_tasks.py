"""Background export tasks — Go service handles all PDF formats."""
import logging
import os
from typing import Any, Dict

logger = logging.getLogger("olpdf-api")

EXPORT_SERVICE_URL = os.environ.get("EXPORT_SERVICE_URL", "").rstrip("/")
WORKER_SECRET = os.environ.get("WORKER_SECRET", "")


async def _export_via_go(doc_model: Dict[str, Any], format_type: str) -> bytes:
    """Call the Go export service. Raises on failure."""
    if not EXPORT_SERVICE_URL:
        raise RuntimeError("EXPORT_SERVICE_URL is not configured")
    import httpx
    headers = {
        "Content-Type": "application/json",
        "X-Worker-Secret": WORKER_SECRET,
    }
    payload = {
        "document_model": doc_model,
        "color_space": doc_model.get("meta", {}).get("color_space", "rgb"),
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{EXPORT_SERVICE_URL}/export/{format_type}",
            headers=headers,
            json=payload,
        )
    if resp.status_code != 200:
        raise RuntimeError(
            f"Go export service returned {resp.status_code} for {format_type}: {resp.text}"
        )
    return resp.content


async def run_export_and_notify(doc_id: str, format_type: str, user_id: str) -> None:
    from ...core.supabase_client import supabase
    from ...services.storage_service import upload_export
    from ...services.notification_service import send_export_ready_notification

    doc_res = supabase.table("documents").select("*").eq("id", doc_id).single().execute()
    doc = doc_res.data
    if not doc:
        logger.error("Export task: document %s not found", doc_id)
        return

    doc_model = doc["document_model"]

    try:
        pdf_bytes = await _export_via_go(doc_model, format_type)
    except Exception as exc:
        logger.error("Export failed for doc %s (format=%s): %s", doc_id, format_type, exc)
        return

    if not pdf_bytes:
        logger.error("Export produced no bytes for doc %s", doc_id)
        return

    export_url = upload_export(doc_id, format_type, pdf_bytes)
    if export_url:
        send_export_ready_notification(
            user_id, doc.get("title", "Your document"), export_url, format_type
        )
