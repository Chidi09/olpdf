from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import os
from ..core.supabase_client import get_supabase
from ..core.auth import get_current_user
from ..models import PluginResponse, PluginSubmitPayload
from ..services import plugin_service

router = APIRouter(prefix="/plugins", tags=["plugins"])


def _user_id(payload: dict) -> str:
    return str(payload.get("user_id") or payload.get("sub") or "")

@router.get("/", response_model=List[PluginResponse])
async def list_plugins(
    category: str = None,
    current_user: dict = Depends(get_current_user)
):
    """List all published plugins, or unpublished plugins authored by the current user."""
    supabase = get_supabase()
    query = supabase.table("plugins").select("*")
    
    if category:
        query = query.eq("category", category)
    
    # RLS handles the visibility (is_published OR author_id = auth.uid())
    response = query.execute()
    return response.data

@router.post("/submit", response_model=PluginResponse)
async def submit_plugin(
    payload: PluginSubmitPayload,
    current_user: dict = Depends(get_current_user)
):
    """Submit a new plugin for review."""
    return plugin_service.submit_plugin(
        author_id=_user_id(current_user),
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        manifest=payload.manifest,
        bundle_url=payload.bundle_url,
        version=payload.version,
        category=payload.category
    )

@router.patch("/{plugin_id}/verify")
async def verify_plugin(
    plugin_id: str,
    verified: bool,
    current_user: dict = Depends(get_current_user)
):
    """Verify and publish a plugin (admin only)."""
    admin_ids = {v.strip() for v in os.environ.get("PLUGIN_ADMIN_IDS", "").split(",") if v.strip()}
    if _user_id(current_user) not in admin_ids:
        raise HTTPException(status_code=403, detail="Admin access required")
    supabase = get_supabase()
    
    response = supabase.table("plugins").update({
        "is_verified": verified,
        "is_published": verified,
        "updated_at": "now()"
    }).eq("id", plugin_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Plugin not found")
    
    return {"message": f"Plugin verification status set to {verified}"}
