"""Async email dispatch tasks for background processing."""
import logging

logger = logging.getLogger("olpdf-api")


async def send_workspace_invite_email(to: str, workspace_name: str, invite_token: str) -> None:
    from ...email.email_service import send_email
    from ...config import get_settings
    settings = get_settings()
    sign_url = f"{settings.app_url}/join?token={invite_token}"
    html = f"<p>You've been invited to join <strong>{workspace_name}</strong> on OLPDF. <a href='{sign_url}'>Accept invitation</a>.</p>"
    text = f"You've been invited to join {workspace_name} on OLPDF. Accept here: {sign_url}"
    send_email(to, f"You've been invited to join {workspace_name} — OLPDF", html, text)
