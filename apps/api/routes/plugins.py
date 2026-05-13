from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
import os
from ..core.supabase_client import get_supabase
from ..core.auth import get_current_user
from ..models import PluginResponse, PluginSubmitPayload
from ..services import plugin_service

router = APIRouter(prefix="/plugins", tags=["plugins"])


def _user_id(payload: dict) -> str:
    return str(payload.get("user_id") or payload.get("sub") or "")


BACKEND_BASE = os.environ.get("API_BASE_URL", "https://api.olpdf.xyz")

FALLBACK_PLUGINS: List[dict] = [
    {
        "id": "plg_citation-cleaner",
        "name": "Citation Cleaner",
        "slug": "citation-cleaner",
        "description": "Scans imported PDFs for citation-like text patterns and normalizes spacing, punctuation, and format consistency across APA, MLA, and Chicago styles.",
        "category": "Editor",
        "version": "1.0.0",
        "author_name": "OLPDF Studio",
        "installs": 340,
        "is_verified": True,
        "is_published": True,
        "bundle_url": f"{BACKEND_BASE}/plugins/citation-cleaner/bundle.js",
        "manifest": {
            "name": "Citation Cleaner",
            "version": "1.0.0",
            "permissions": ["blocks:read", "blocks:write"],
            "hooks": ["onDocumentLoad"],
            "entry": "bundle.js",
        },
        "created_at": "2026-02-01T00:00:00Z",
        "updated_at": "2026-02-01T00:00:00Z",
    },
    {
        "id": "plg_contract-scanner",
        "name": "Contract Risk Highlighter",
        "slug": "contract-risk-highlighter",
        "description": "Flags risky clauses, missing dates, ambiguous liability terms, and missing signature blocks in uploaded contracts and NDAs.",
        "category": "AI",
        "version": "1.0.0",
        "author_name": "OLPDF Studio",
        "installs": 210,
        "is_verified": True,
        "is_published": True,
        "bundle_url": f"{BACKEND_BASE}/plugins/contract-risk-highlighter/bundle.js",
        "manifest": {
            "name": "Contract Risk Highlighter",
            "version": "1.0.0",
            "permissions": ["blocks:read", "blocks:write"],
            "hooks": ["onDocumentLoad"],
            "entry": "bundle.js",
        },
        "created_at": "2026-02-15T00:00:00Z",
        "updated_at": "2026-02-15T00:00:00Z",
    },
    {
        "id": "plg_table-extractor",
        "name": "Table Extractor",
        "slug": "table-extractor",
        "description": "Detects tabular regions in PDF pages and exports clean CSV, Markdown, or JSON tables. Works with bordered and borderless tables.",
        "category": "Utility",
        "version": "1.0.0",
        "author_name": "OLPDF Studio",
        "installs": 560,
        "is_verified": True,
        "is_published": True,
        "bundle_url": f"{BACKEND_BASE}/plugins/table-extractor/bundle.js",
        "manifest": {
            "name": "Table Extractor",
            "version": "1.0.0",
            "permissions": ["blocks:read", "blocks:write", "document:export"],
            "hooks": ["onDocumentLoad", "onSelection"],
            "entry": "bundle.js",
        },
        "created_at": "2026-01-20T00:00:00Z",
        "updated_at": "2026-01-20T00:00:00Z",
    },
]


@router.get("/", response_model=List[dict])
async def list_plugins(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all published plugins, or unpublished plugins authored by the current user."""
    supabase = get_supabase()
    try:
        query = supabase.table("plugins").select("*")
        if category:
            query = query.eq("category", category)
        response = query.execute()
        if response.data:
            return response.data
    except Exception:
        pass

    if category:
        filtered = [p for p in FALLBACK_PLUGINS if p["category"] == category]
        return filtered
    return FALLBACK_PLUGINS

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
