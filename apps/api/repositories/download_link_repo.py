import secrets
from typing import Any, Dict, Optional
from ..core.supabase_client import supabase


class DownloadLinkRepository:
    @staticmethod
    def create(owner_id: str, object_key: str, filename: str, content_type: str = "application/pdf", expires_at: Optional[str] = None) -> Dict[str, Any]:
        slug = secrets.token_urlsafe(8).replace("-", "").replace("_", "")[:8]
        payload = {
            "slug": slug,
            "owner_id": owner_id,
            "object_key": object_key,
            "filename": filename,
            "content_type": content_type,
            "expires_at": expires_at,
        }
        supabase.table("download_links").insert(payload).execute()
        return {"slug": slug, "object_key": object_key, "filename": filename, "content_type": content_type, "url": f"/d/{slug}"}

    @staticmethod
    def get_by_slug(slug: str) -> Optional[Dict[str, Any]]:
        try:
            res = supabase.table("download_links").select("*").eq("slug", slug).single().execute()
            return res.data
        except Exception:
            return None
