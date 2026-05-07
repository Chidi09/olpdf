import hashlib
import hmac
import json
import logging
import asyncio
from typing import Any

import httpx

from ..core.supabase_client import supabase_admin

logger = logging.getLogger("olpdf-api")

RETRY_DELAYS_SECONDS = [30, 300, 1800, 7200, 86400]


def _log_delivery(webhook_id: str, event: str, payload: dict, status: int | None, attempt: int, response_body: str = "") -> None:
    try:
        supabase_admin.table("webhook_deliveries").insert(
            {
                "webhook_id": webhook_id,
                "event": event,
                "payload": payload,
                "response_status": status,
                "response_body": response_body[:5000],
                "attempt_count": attempt,
            }
        ).execute()
    except Exception as exc:
        logger.error("Failed to persist webhook delivery log: %s", exc)


async def _retry_with_backoff(webhook: dict, event: str, payload: dict) -> None:
    body = json.dumps({"event": event, "data": payload})
    signature = hmac.new(webhook.get("secret", "").encode(), body.encode(), hashlib.sha256).hexdigest()
    for attempt, delay in enumerate(RETRY_DELAYS_SECONDS, start=1):
        await asyncio.sleep(delay)
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook["url"],
                    content=body,
                    headers={"Content-Type": "application/json", "X-OLPDF-Signature": f"sha256={signature}", "X-OLPDF-Event": event},
                    timeout=10.0,
                )
            _log_delivery(webhook["id"], event, payload, response.status_code, attempt=attempt + 1, response_body=response.text)
            if 200 <= response.status_code < 300:
                logger.info("Webhook retry succeeded for %s on attempt %d", webhook["id"], attempt)
                return
        except Exception as exc:
            _log_delivery(webhook["id"], event, payload, None, attempt=attempt + 1, response_body=str(exc))
            logger.error("Webhook retry failed for %s (attempt %d): %s", webhook["id"], attempt, exc)


async def dispatch_webhook(event: str, payload: dict, user_id: str) -> None:
    try:
        res = supabase_admin.table("webhooks").select("*").eq("user_id", user_id).eq("is_active", True).execute()
        if not res.data:
            return
        webhooks = [w for w in res.data if event in w.get("events", [])]
        if not webhooks:
            return
        logger.info("Dispatching event %s to %d webhook(s)", event, len(webhooks))
        for webhook in webhooks:
            body = json.dumps({"event": event, "data": payload})
            signature = hmac.new(webhook.get("secret", "").encode(), body.encode(), hashlib.sha256).hexdigest()
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        webhook["url"],
                        content=body,
                        headers={"Content-Type": "application/json", "X-OLPDF-Signature": f"sha256={signature}", "X-OLPDF-Event": event},
                        timeout=10.0,
                    )
                _log_delivery(webhook["id"], event, payload, response.status_code, attempt=1, response_body=response.text)
                logger.info("Dispatched webhook %s for event %s", webhook["id"], event)
                if response.status_code >= 300:
                    asyncio.create_task(_retry_with_backoff(webhook, event, payload))
            except Exception as exc:
                _log_delivery(webhook["id"], event, payload, None, attempt=1, response_body=str(exc))
                logger.error("Failed to dispatch webhook %s: %s", webhook["id"], exc)
                asyncio.create_task(_retry_with_backoff(webhook, event, payload))
    except Exception as exc:
        logger.error("Error in webhook dispatcher: %s", exc)
