import os
from .services.notification_service import (  # noqa: F401
    send_import_complete_notification,
    send_export_ready_notification,
    send_ocr_partial_notification,
    send_signature_request_notification,
    send_signature_complete_notification,
)

APP_URL: str = os.environ.get("APP_URL", "https://olpdf.xyz")


def send_email(to: str, subject: str, html: str) -> None:
    from .email.email_service import send_email as _send
    _send(to, subject, html)
