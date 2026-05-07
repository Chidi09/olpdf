"""Background export tasks — dispatched via QStash or called directly by workers."""
import logging
from typing import Any, Dict

logger = logging.getLogger("olpdf-api")


async def run_export_and_notify(doc_id: str, format_type: str, user_id: str) -> None:
    from ...core.supabase_client import supabase
    from ...engine.exporter import export_fidelity, export_pdfa, export_tagged_pdf
    from ...services.storage_service import upload_export
    from ...services.notification_service import send_export_ready_notification

    doc_res = supabase.table("documents").select("*").eq("id", doc_id).single().execute()
    doc = doc_res.data
    if not doc:
        logger.error("Export task: document %s not found", doc_id)
        return

    doc_model = doc["document_model"]
    meta = doc_model.get("meta", {})
    color_space = meta.get("color_space", "rgb")

    try:
        if format_type == "fidelity":
            pdf_bytes = export_fidelity(doc_model, color_space)
        elif format_type == "tagged":
            pdf_bytes = export_tagged_pdf(doc_model)
        else:
            pdf_bytes = export_pdfa(doc_model)
    except Exception as exc:
        logger.error("Export failed for doc %s: %s", doc_id, exc)
        return

    export_url = upload_export(doc_id, format_type, pdf_bytes)
    if export_url:
        send_export_ready_notification(user_id, doc.get("title", "Your document"), export_url, format_type)
