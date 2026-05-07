import secrets
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from ..models import WebhookCreatePayload
from ..auth_utils import require_auth, require_scopes
from ..repositories import AuditLogRepository
from ..supabase_client import supabase

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

@router.get("")
async def list_webhooks(user: dict = Depends(require_auth)) -> List[Dict[str, Any]]:
    await require_scopes(["webhooks:manage"])(user)
    res = supabase.table("webhooks").select("id, url, events, is_active, created_at").eq("user_id", user["sub"]).execute()
    return res.data or []

@router.post("")
async def create_webhook(payload: WebhookCreatePayload, user: dict = Depends(require_auth)) -> Dict[str, Any]:
    await require_scopes(["webhooks:manage"])(user)
    secret = f"whsec_{secrets.token_urlsafe(32)}"
    res = supabase.table("webhooks").insert({
        "user_id": user["sub"],
        "url": payload.url,
        "events": payload.events,
        "secret": secret
    }).execute()
    
    data = res.data[0]
    AuditLogRepository.create(
        user_id=user["sub"],
        resource_id=str(data["id"]),
        resource_type="webhook",
        action="created",
        metadata={"events": payload.events},
    )
    return {"id": data["id"], "url": data["url"], "events": data["events"], "secret": secret}

@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: str, user: dict = Depends(require_auth)) -> dict:
    await require_scopes(["webhooks:manage"])(user)
    supabase.table("webhooks").delete().eq("id", webhook_id).eq("user_id", user["sub"]).execute()
    AuditLogRepository.create(
        user_id=user["sub"],
        resource_id=webhook_id,
        resource_type="webhook",
        action="deleted",
    )
    return {"status": "success"}
