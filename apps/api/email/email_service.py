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


def _base_ctx() -> dict:
    return {"app_url": APP_URL}


def send_email(to: str, subject: str, html_body: str, text_body: str = "") -> bool:
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
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"from": EMAIL_FROM, "to": [to], "subject": subject, "html": html_body, "text": text_body},
            timeout=10,
        )
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


# ─── Auth ────────────────────────────────────────────────────────────────────

def send_welcome(to: str, name: str) -> None:
    ctx = {**_base_ctx(), "name": name}
    send_email(to, f"Welcome to OLPDF, {name}!", _render("welcome.html", ctx))


def send_verify_email(to: str, name: str, verify_url: str) -> None:
    ctx = {**_base_ctx(), "name": name, "verify_url": verify_url}
    send_email(to, "Verify your email — OLPDF", _render("verify_email.html", ctx))


def send_magic_link(to: str, magic_url: str) -> None:
    ctx = {**_base_ctx(), "magic_url": magic_url}
    send_email(to, "Your magic sign-in link — OLPDF", _render("magic_link.html", ctx))


def send_password_reset(to: str, name: str, reset_url: str) -> None:
    ctx = {**_base_ctx(), "name": name, "reset_url": reset_url}
    send_email(to, "Reset your password — OLPDF", _render("password_reset.html", ctx))


# ─── API Keys ────────────────────────────────────────────────────────────────

def send_api_key_created(to: str, name: str, key_name: str, key_prefix: str, scopes: str) -> None:
    ctx = {**_base_ctx(), "name": name, "key_name": key_name, "key_prefix": key_prefix, "scopes": scopes}
    send_email(to, f"New API key created: {key_name} — OLPDF", _render("api_key_created.html", ctx))


def send_api_key_revoked(to: str, name: str, key_name: str, key_prefix: str) -> None:
    ctx = {**_base_ctx(), "name": name, "key_name": key_name, "key_prefix": key_prefix}
    send_email(to, f"API key revoked: {key_name} — OLPDF", _render("api_key_revoked.html", ctx))


# ─── Documents ───────────────────────────────────────────────────────────────

def send_document_complete(to: str, name: str, doc_title: str, doc_url: str, page_count: int = 0) -> None:
    ctx = {**_base_ctx(), "name": name, "doc_title": doc_title, "doc_url": doc_url, "page_count": page_count}
    send_email(to, f"'{doc_title}' is ready — OLPDF", _render("document_complete.html", ctx))


def send_document_failed(to: str, name: str, doc_title: str, error_message: str) -> None:
    ctx = {**_base_ctx(), "name": name, "doc_title": doc_title, "error_message": error_message}
    send_email(to, f"Processing failed: '{doc_title}' — OLPDF", _render("document_failed.html", ctx))


def send_export_ready(to: str, name: str, doc_title: str, export_url: str, format_type: str) -> None:
    ctx = {**_base_ctx(), "name": name, "doc_title": doc_title, "export_url": export_url, "format_type": format_type}
    send_email(to, f"Your {format_type.upper()} export of '{doc_title}' is ready — OLPDF", _render("export_ready.html", ctx))


def send_ocr_partial(to: str, name: str, doc_title: str, doc_id: str, pages_ocr: int) -> None:
    ctx = {**_base_ctx(), "name": name, "doc_title": doc_title, "doc_id": doc_id, "pages_ocr": pages_ocr}
    send_email(to, f"'{doc_title}' is partially ready — OCR in progress — OLPDF", _render("ocr_partial.html", ctx))


# ─── Billing ─────────────────────────────────────────────────────────────────

def send_payment_failed(to: str, name: str, amount: str, plan: str, retry_url: str) -> None:
    ctx = {**_base_ctx(), "name": name, "amount": amount, "plan": plan, "retry_url": retry_url}
    send_email(to, "Payment failed — action required — OLPDF", _render("payment_failed.html", ctx))


def send_invoice(
    to: str,
    name: str,
    invoice_number: str,
    amount: str,
    plan: str,
    billing_date: str,
    period_start: str,
    period_end: str,
) -> None:
    ctx = {
        **_base_ctx(),
        "name": name,
        "invoice_number": invoice_number,
        "amount": amount,
        "plan": plan,
        "billing_date": billing_date,
        "period_start": period_start,
        "period_end": period_end,
    }
    send_email(to, f"Invoice {invoice_number} — OLPDF", _render("invoice.html", ctx))


def send_plan_upgraded(to: str, name: str, old_plan: str, new_plan: str) -> None:
    ctx = {**_base_ctx(), "name": name, "old_plan": old_plan, "new_plan": new_plan}
    send_email(to, f"You're now on {new_plan} — OLPDF", _render("plan_upgraded.html", ctx))


def send_plan_downgraded(to: str, name: str, old_plan: str, new_plan: str, effective_date: str) -> None:
    ctx = {**_base_ctx(), "name": name, "old_plan": old_plan, "new_plan": new_plan, "effective_date": effective_date}
    send_email(to, f"Your plan is changing to {new_plan} — OLPDF", _render("plan_downgraded.html", ctx))


# ─── Team ────────────────────────────────────────────────────────────────────

def send_team_invite(to: str, inviter_name: str, workspace_name: str, role: str, invite_url: str) -> None:
    ctx = {**_base_ctx(), "inviter_name": inviter_name, "workspace_name": workspace_name, "role": role, "invite_url": invite_url}
    send_email(to, f"{inviter_name} invited you to {workspace_name} — OLPDF", _render("team_invite.html", ctx))


def send_team_removed(to: str, name: str, workspace_name: str) -> None:
    ctx = {**_base_ctx(), "name": name, "workspace_name": workspace_name}
    send_email(to, f"You've been removed from {workspace_name} — OLPDF", _render("team_removed.html", ctx))


# ─── Signatures ──────────────────────────────────────────────────────────────

def send_signature_request(to: str, requester_name: str, doc_title: str, sign_url: str, expires_at: str = "") -> None:
    ctx = {**_base_ctx(), "requester_name": requester_name, "doc_title": doc_title, "sign_url": sign_url, "expires_at": expires_at}
    send_email(to, f"{requester_name} is requesting your signature — OLPDF", _render("signature_request.html", ctx))


def send_signature_complete(to: str, name: str, doc_title: str, certified_url: str) -> None:
    ctx = {**_base_ctx(), "name": name, "doc_title": doc_title, "certified_url": certified_url}
    send_email(to, f"Document fully signed: {doc_title} — OLPDF", _render("signature_complete.html", ctx))


# ─── Webhooks ────────────────────────────────────────────────────────────────

def send_webhook_failure(
    to: str,
    name: str,
    endpoint_url: str,
    event_type: str,
    failure_count: int,
    next_retry: str,
) -> None:
    ctx = {
        **_base_ctx(),
        "name": name,
        "endpoint_url": endpoint_url,
        "event_type": event_type,
        "failure_count": failure_count,
        "next_retry": next_retry,
    }
    send_email(to, f"Webhook delivery failing: {endpoint_url} — OLPDF", _render("webhook_failure.html", ctx))


# ─── Account ─────────────────────────────────────────────────────────────────

def send_delete_warning(to: str, name: str, deletion_date: str, cancel_url: str) -> None:
    ctx = {**_base_ctx(), "name": name, "deletion_date": deletion_date, "cancel_url": cancel_url}
    send_email(to, "Your OLPDF account is scheduled for deletion", _render("delete_warning.html", ctx))


def send_delete_confirmed(to: str, name: str) -> None:
    ctx = {**_base_ctx(), "name": name}
    send_email(to, "Your OLPDF account has been deleted", _render("delete_confirmed.html", ctx))


def send_usage_summary(
    to: str,
    name: str,
    month: str,
    docs_processed: int,
    api_calls: int,
    storage_used: str,
    exports_count: int,
    plan: str,
    quota_docs: int,
    quota_api: int,
) -> None:
    ctx = {
        **_base_ctx(),
        "name": name,
        "month": month,
        "docs_processed": docs_processed,
        "api_calls": api_calls,
        "storage_used": storage_used,
        "exports_count": exports_count,
        "plan": plan,
        "quota_docs": quota_docs,
        "quota_api": quota_api,
    }
    send_email(to, f"Your {month} usage summary — OLPDF", _render("usage_summary.html", ctx))
