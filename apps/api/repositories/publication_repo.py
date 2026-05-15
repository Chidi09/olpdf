import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List
from ..core.supabase_client import supabase


class PublicationRepository:
    @staticmethod
    def create(
        owner_id: str,
        source_type: str,
        source_id: str,
        title: str,
        snapshot: Dict[str, Any],
        visibility: str = "unlisted",
        description: str = "",
        artifact_keys: Optional[List[str]] = None,
        artifact_links: Optional[List[Dict[str, str]]] = None,
        parent_publication_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        slug = secrets.token_urlsafe(8).replace("-", "").replace("_", "")[:8]
        payload = {
            "slug": slug,
            "owner_id": owner_id,
            "source_type": source_type,
            "source_id": source_id,
            "title": title,
            "description": description,
            "visibility": visibility,
            "status": "published",
            "snapshot": snapshot,
            "artifact_keys": artifact_keys or [],
            "artifact_links": artifact_links or [],
            "version": 1,
            "published_at": datetime.now(timezone.utc).isoformat(),
        }
        if parent_publication_id:
            payload["parent_publication_id"] = parent_publication_id
        supabase.table("publications").insert(payload).execute()
        return {
            "slug": slug,
            "title": title,
            "visibility": visibility,
            "status": "published",
            "version": 1,
            "url": f"/p/{slug}",
            "artifact_count": len(artifact_links or []),
        }

    @staticmethod
    def create_version(
        parent_slug: str,
        owner_id: str,
        title: str,
        description: str,
        snapshot: Dict[str, Any],
        artifact_keys: Optional[List[str]] = None,
        artifact_links: Optional[List[Dict[str, str]]] = None,
        visibility: str = "unlisted",
    ) -> Optional[Dict[str, Any]]:
        parent = PublicationRepository.get_by_slug(parent_slug)
        if not parent:
            return None
        if str(parent.get("owner_id")) != owner_id:
            return None
        new_version = parent.get("version", 1) + 1
        return PublicationRepository.create(
            owner_id=owner_id,
            source_type=parent.get("source_type", "document"),
            source_id=parent.get("source_id", ""),
            title=title or parent.get("title", "Untitled"),
            description=description or parent.get("description", ""),
            snapshot=snapshot,
            visibility=visibility,
            artifact_keys=artifact_keys,
            artifact_links=artifact_links,
            parent_publication_id=parent.get("id"),
        )

    @staticmethod
    def get_by_slug(slug: str, include_unpublished: bool = False) -> Optional[Dict[str, Any]]:
        try:
            query = supabase.table("publications").select("*").eq("slug", slug)
            if not include_unpublished:
                query = query.neq("status", "unpublished")
            res = query.single().execute()
            return res.data
        except Exception:
            return None

    @staticmethod
    def list_for_owner(owner_id: str) -> List[Dict[str, Any]]:
        try:
            res = (
                supabase.table("publications")
                .select("*")
                .eq("owner_id", owner_id)
                .order("published_at", desc=True)
                .execute()
            )
            return res.data or []
        except Exception:
            return []

    @staticmethod
    def list_public(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        try:
            res = (
                supabase.table("publications")
                .select("*")
                .eq("visibility", "public")
                .eq("status", "published")
                .order("published_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            return res.data or []
        except Exception:
            return []

    @staticmethod
    def list_versions(slug: str) -> List[Dict[str, Any]]:
        try:
            parent = PublicationRepository.get_by_slug(slug, include_unpublished=True)
            if not parent:
                return []
            parent_id = parent.get("id")
            res = (
                supabase.table("publications")
                .select("*")
                .or_(f"slug.eq.{slug},parent_publication_id.eq.{parent_id}")
                .order("version", desc=True)
                .execute()
            )
            return res.data or []
        except Exception:
            return []

    @staticmethod
    def update_visibility(slug: str, owner_id: str, visibility: str) -> bool:
        pub = PublicationRepository.get_by_slug(slug, include_unpublished=True)
        if not pub or str(pub.get("owner_id")) != owner_id:
            return False
        try:
            supabase.table("publications").update({"visibility": visibility}).eq("slug", slug).execute()
            return True
        except Exception:
            return False

    @staticmethod
    def unpublish(slug: str, owner_id: str) -> bool:
        pub = PublicationRepository.get_by_slug(slug, include_unpublished=True)
        if not pub or str(pub.get("owner_id")) != owner_id:
            return False
        try:
            supabase.table("publications").update({
                "status": "unpublished",
                "unpublished_at": datetime.now(timezone.utc).isoformat(),
            }).eq("slug", slug).execute()
            return True
        except Exception:
            return False
