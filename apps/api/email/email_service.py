import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger("olpdf-api")

APP_URL = os.environ.get("APP_URL", "https://olpdf.xyz")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "noreply@olpdf.xyz")

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))


def _render(template_name: str, context: dict) -> str:
    return _env.get_template(template_name).render(**context)


def send_email(to: str, subject: str, html_body: str, text_body: str) -> bool:
    if not to:
        return False
    success = False
    resend_key = os.environ.get("RESEND_API_KEY")
    if resend_key:
        success = _send_via_resend(resend_key, to, subject, html_body, text_body)
    if not success:
        smtp_host = os.environ.get("SMTP_HOST")
        if smtp_host:
            success = _send_via_smtp(smtp_host, to, subject, html_body, text_body)
    if not success and os.environ.get("OLPDF_DEV_MODE") == "true":
        logger.info("[DEV EMAIL] To: %s | Subject: %s", to, subject)
        return True
    return success


def _send_via_resend(api_key: str, to: str, subject: str, html_body: str, text_body: str) -> bool:
    try:
        import httpx
        resp = httpx.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json={"from": EMAIL_FROM, "to": [to], "subject": subject, "html": html_body, "text": text_body}, timeout=10)
        if resp.status_code not in (200, 201):
            logger.error("Resend API error %s: %s", resp.status_code, resp.text)
            return False
        return True
    except Exception as exc:
        logger.error("Resend email failed: %s", exc)
        return False


def _send_via_smtp(host: str, to: str, subject: str, html_body: str, text_body: str) -> bool:
    try:
        port = int(os.environ.get("SMTP_PORT", 587))
        username = os.environ.get("SMTP_USERNAME", "")
        password = os.environ.get("SMTP_PASSWORD", "")
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = EMAIL_FROM
        msg["To"] = to
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(host, port) as server:
            server.ehlo()
            server.starttls()
            if username and password:
                server.login(username, password)
            server.sendmail(EMAIL_FROM, to, msg.as_string())
        return True
    except Exception as exc:
        logger.error("SMTP email failed: %s", exc)
        return False


def send_import_complete(to: str, doc_title: str, doc_id: str) -> None:
    ctx = {"app_url": APP_URL, "doc_title": doc_title, "doc_id": doc_id}
    send_email(to, f"'{doc_title}' is ready to edit — OLPDF", _render("import_complete.html", ctx), _render("import_complete.txt", ctx))


def send_export_ready(to: str, doc_title: str, export_url: str, format_type: str) -> None:
    ctx = {"app_url": APP_URL, "doc_title": doc_title, "export_url": export_url, "format_type": format_type}
    send_email(to, f"Your {format_type.upper()} export of '{doc_title}' is ready — OLPDF", _render("export_ready.html", ctx), _render("export_ready.txt", ctx))


def send_ocr_partial(to: str, doc_title: str, doc_id: str, pages_ocr: int) -> None:
    ctx = {"app_url": APP_URL, "doc_title": doc_title, "doc_id": doc_id, "pages_ocr": pages_ocr}
    send_email(to, f"'{doc_title}' is partially ready — OCR in progress — OLPDF", _render("ocr_partial.html", ctx), _render("ocr_partial.txt", ctx))


def send_signature_request(to: str, doc_title: str, sign_url: str) -> None:
    ctx = {"app_url": APP_URL, "doc_title": doc_title, "sign_url": sign_url}
    html = f"<p>You have been asked to sign <strong>{doc_title}</strong>. <a href='{sign_url}'>Click here to sign</a>.</p>"
    text = f"Please sign {doc_title}: {sign_url}"
    send_email(to, f"Please sign: {doc_title} — OLPDF", html, text)


def send_signature_complete(to: str, doc_title: str, certified_url: str) -> None:
    ctx = {"app_url": APP_URL, "doc_title": doc_title, "certified_url": certified_url}
    html = f"<p><strong>{doc_title}</strong> has been fully signed. <a href='{certified_url}'>Download certified PDF</a>.</p>"
    text = f"{doc_title} has been fully signed. Download: {certified_url}"
    send_email(to, f"Document fully signed: {doc_title} — OLPDF", html, text)
