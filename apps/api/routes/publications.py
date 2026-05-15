from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth_utils import require_auth
from ..repositories.publication_repo import PublicationRepository

router = APIRouter(prefix="/api/publications", tags=["publications"])


@router.post("")
async def create_publication(payload: Dict[str, Any], user: dict = Depends(require_auth)) -> dict:
    source_type = str(payload.get("source_type", "document"))
    source_id = str(payload.get("source_id", ""))
    title = str(payload.get("title", "Untitled"))
    description = str(payload.get("description", ""))
    snapshot = payload.get("snapshot", {})
    visibility = str(payload.get("visibility", "unlisted"))
    artifact_keys = payload.get("artifact_keys")
    artifact_links = payload.get("artifact_links")

    if not source_id or not snapshot:
        raise HTTPException(status_code=422, detail="source_id and snapshot are required")

    result = PublicationRepository.create(
        owner_id=user["sub"],
        source_type=source_type,
        source_id=source_id,
        title=title,
        description=description,
        snapshot=snapshot,
        visibility=visibility,
        artifact_keys=artifact_keys,
        artifact_links=artifact_links,
    )
    return result


@router.get("/{slug}")
async def get_publication(slug: str) -> dict:
    pub = PublicationRepository.get_by_slug(slug)
    if not pub:
        raise HTTPException(status_code=404, detail="Publication not found")
    if pub.get("status") == "unpublished":
        pub = PublicationRepository.get_by_slug(slug, include_unpublished=True)
        if pub and pub.get("status") == "unpublished":
            raise HTTPException(status_code=404, detail="Publication not found")
    return pub


@router.get("")
async def list_publications(
    owner: Optional[str] = Query(None),
    public: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict = Depends(require_auth),
) -> Dict[str, Any]:
    if public:
        items = PublicationRepository.list_public(limit=limit, offset=offset)
    else:
        owner_id = owner or user["sub"]
        items = PublicationRepository.list_for_owner(owner_id)
    return {"publications": items, "limit": limit, "offset": offset}


@router.get("/{slug}/versions")
async def list_publication_versions(slug: str) -> List[Dict[str, Any]]:
    versions = PublicationRepository.list_versions(slug)
    return versions


@router.post("/{slug}/versions")
async def create_publication_version(
    slug: str,
    payload: Dict[str, Any],
    user: dict = Depends(require_auth),
) -> dict:
    result = PublicationRepository.create_version(
        parent_slug=slug,
        owner_id=user["sub"],
        title=str(payload.get("title", "")),
        description=str(payload.get("description", "")),
        snapshot=payload.get("snapshot", {}),
        artifact_keys=payload.get("artifact_keys"),
        artifact_links=payload.get("artifact_links"),
        visibility=str(payload.get("visibility", "unlisted")),
    )
    if not result:
        raise HTTPException(status_code=404, detail="Parent publication not found or access denied")
    return result


@router.patch("/{slug}/visibility")
async def update_publication_visibility(
    slug: str,
    payload: Dict[str, Any],
    user: dict = Depends(require_auth),
) -> dict:
    visibility = str(payload.get("visibility", "unlisted"))
    if visibility not in ("private", "unlisted", "public"):
        raise HTTPException(status_code=422, detail="Invalid visibility")
    ok = PublicationRepository.update_visibility(slug, user["sub"], visibility)
    if not ok:
        raise HTTPException(status_code=404, detail="Publication not found or access denied")
    return {"slug": slug, "visibility": visibility, "status": "updated"}


@router.post("/{slug}/unpublish")
async def unpublish_publication(
    slug: str,
    user: dict = Depends(require_auth),
) -> dict:
    ok = PublicationRepository.unpublish(slug, user["sub"])
    if not ok:
        raise HTTPException(status_code=404, detail="Publication not found or access denied")
    return {"slug": slug, "status": "unpublished"}
