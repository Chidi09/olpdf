from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth_utils import require_auth
from ..core.supabase_client import supabase
from ..services.ai_providers import PROVIDER_CONFIGS, encrypt_key

router = APIRouter(prefix="/api/ai-settings", tags=["ai-settings"])


class AiSettingsPayload(BaseModel):
    provider: str
    model: Optional[str] = None
    api_key: Optional[str] = None  # write-only; omit to keep existing key


@router.get("")
async def get_ai_settings(user: dict = Depends(require_auth)):
    user_id = user["sub"]
    try:
        row = (
            supabase.table("user_ai_settings")
            .select("provider, model, encrypted_api_key")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        data = row.data or {}
    except Exception:
        data = {}
    return {
        "provider": data.get("provider", "gemini_free"),
        "model": data.get("model"),
        "key_set": bool(data.get("encrypted_api_key")),
        "providers": PROVIDER_CONFIGS,
    }


@router.put("")
async def save_ai_settings(payload: AiSettingsPayload, user: dict = Depends(require_auth)):
    user_id = user["sub"]
    cfg = PROVIDER_CONFIGS.get(payload.provider)
    if not cfg:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {payload.provider}")

    if cfg["requires_key"]:
        # Check if user already has a stored key when none is being provided now
        try:
            existing = (
                supabase.table("user_ai_settings")
                .select("encrypted_api_key")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            has_existing = bool(existing.data and existing.data.get("encrypted_api_key"))
        except Exception:
            has_existing = False

        if not payload.api_key and not has_existing:
            raise HTTPException(status_code=400, detail="An API key is required for this provider.")

    upsert_data: dict = {
        "user_id": user_id,
        "provider": payload.provider,
        "model": payload.model or cfg["default_model"],
    }

    if payload.api_key:
        upsert_data["encrypted_api_key"] = encrypt_key(payload.api_key)

    try:
        supabase.table("user_ai_settings").upsert(upsert_data).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save AI settings: {exc}")
    return {"status": "saved", "provider": payload.provider}


@router.delete("/key")
async def clear_api_key(user: dict = Depends(require_auth)):
    """Remove stored API key — reverts user to the free Gemini tier."""
    user_id = user["sub"]
    supabase.table("user_ai_settings").upsert({
        "user_id": user_id,
        "provider": "gemini_free",
        "model": None,
        "encrypted_api_key": None,
    }).execute()
    return {"status": "cleared"}
