import os
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Request

from ..auth_utils import require_auth
from ..limiter import limiter
from ..repositories.download_link_repo import DownloadLinkRepository
from ..core.storage_client import r2_storage
from ..core.auth import verify_worker_secret

router = APIRouter(prefix="/api/downloads", tags=["downloads"])


def _resolve_user(request: Request, payload: Dict[str, Any]) -> Optional[dict]:
    worker_secret = request.headers.get("X-Worker-Secret", "")
    env_secret = os.environ.get("WORKER_SECRET", "")
    if worker_secret and env_secret and worker_secret == env_secret:
        owner_id = str(payload.get("owner_id", ""))
        if owner_id:
            return {"sub": owner_id}
    return None


@router.post("")
@limiter.limit("30/minute")
async def create_download_link(request: Request, payload: Dict[str, Any], user: dict = Depends(require_auth)) -> dict:
    object_key = str(payload.get("object_key", ""))
    filename = str(payload.get("filename", "download.pdf"))
    content_type = str(payload.get("content_type", "application/pdf"))
    expires_at = payload.get("expires_at")

    if not object_key:
        raise HTTPException(status_code=422, detail="object_key is required")

    # Check if this is called by the Go worker service via X-Worker-Secret
    worker_user = _resolve_user(request, payload)
    owner_id = worker_user["sub"] if worker_user else user["sub"]

    link = DownloadLinkRepository.create(
        owner_id=owner_id,
        object_key=object_key,
        filename=filename,
        content_type=content_type,
        expires_at=expires_at,
    )
    return link


@router.get("/{slug}")
@limiter.limit("60/minute")
async def resolve_download_link(request: Request, slug: str, user: dict = Depends(require_auth)) -> dict:
    link = DownloadLinkRepository.get_by_slug(slug)
    if not link:
        raise HTTPException(status_code=404, detail="Download link not found")

    signed_url = r2_storage.generate_presigned_url(link["object_key"], expiration=3600)
    if not signed_url:
        raise HTTPException(status_code=500, detail="Failed to generate download URL")

    return {
        "slug": link["slug"],
        "url": signed_url,
        "filename": link["filename"],
        "content_type": link["content_type"],
        "created_at": link.get("created_at"),
    }
