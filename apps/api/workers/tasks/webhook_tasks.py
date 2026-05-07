"""Webhook retry and delivery tasks."""
import logging

logger = logging.getLogger("olpdf-api")


async def retry_failed_webhook(webhook_id: str, event: str, payload: dict, attempt: int) -> None:
    from ...core.supabase_client import supabase_admin
    import httpx
    import hmac
    import hashlib
    import json

    try:
        res = supabase_admin.table("webhooks").select("*").eq("id", webhook_id).single().execute()
        webhook = res.data
        if not webhook or not webhook.get("is_active"):
            return

        body = json.dumps({"event": event, "data": payload})
        signature = hmac.new(webhook.get("secret", "").encode(), body.encode(), hashlib.sha256).hexdigest()
        async with httpx.AsyncClient() as client:
            await client.post(webhook["url"], content=body, headers={"Content-Type": "application/json", "X-OLPDF-Signature": f"sha256={signature}", "X-OLPDF-Event": event}, timeout=10.0)
        logger.info("Retry %d succeeded for webhook %s", attempt, webhook_id)
    except Exception as exc:
        logger.error("Retry %d failed for webhook %s: %s", attempt, webhook_id, exc)
