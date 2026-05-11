"""
Notification orchestration — combines email delivery with user lookup.
Transport logic lives in email/email_service.py.
"""
import logging
from typing import Optional

logger = logging.getLogger("olpdf-api")


def get_user_email(user_id: str) -> Optional[str]:
    try:
        from ..core.supabase_client import supabase_admin
        res = supabase_admin.auth.admin.get_user_by_id(user_id)
        return res.user.email if res and res.user else None
    except Exception as exc:
        logger.warning("Could not fetch email for user %s: %s", user_id, exc)
        return None


def send_import_complete_notification(user_id: str, doc_title: str, doc_id: str) -> None:
    from ..email.email_service import send_document_complete
    to = get_user_email(user_id)
    if to:
        doc_url = f"{_app_url()}/editor/{doc_id}"
        send_document_complete(to, "", doc_title, doc_url)


def send_export_ready_notification(user_id: str, doc_title: str, export_url: str, format_type: str) -> None:
    from ..email.email_service import send_export_ready
    to = get_user_email(user_id)
    if to:
        send_export_ready(to, "", doc_title, export_url, format_type)


def send_ocr_partial_notification(user_id: str, doc_title: str, doc_id: str, pages_ocr: int) -> None:
    from ..email.email_service import send_ocr_partial
    to = get_user_email(user_id)
    if to:
        send_ocr_partial(to, "", doc_title, doc_id, pages_ocr)


def send_signature_request_notification(signer_email: str, doc_title: str, sign_url: str) -> None:
    from ..email.email_service import send_signature_request
    send_signature_request(signer_email, "", doc_title, sign_url)


def send_signature_complete_notification(user_id: str, doc_title: str, certified_url: str) -> None:
    from ..email.email_service import send_signature_complete
    to = get_user_email(user_id)
    if to:
        send_signature_complete(to, "", doc_title, certified_url)


def _app_url() -> str:
    import os
    return os.environ.get("APP_URL", "https://olpdf.xyz")
