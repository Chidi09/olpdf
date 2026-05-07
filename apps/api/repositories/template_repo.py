from typing import Any, Dict, List, Optional
from ..core.supabase_client import supabase


class TemplateRepository:
    @staticmethod
    def list_all(category: Optional[str] = None, published_only: bool = True) -> List[Dict[str, Any]]:
        q = supabase.table("templates").select("*")
        if published_only:
            q = q.eq("is_published", True)
        if category:
            q = q.eq("category", category)
        return q.order("created_at", desc=True).execute().data or []

    @staticmethod
    def get_by_id(template_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("templates").select("*").eq("id", template_id).single().execute()
        return res.data

    @staticmethod
    def create(author_id: str, title: str, description: str, category: str, document_id: str, price_pence: int = 0) -> Dict[str, Any]:
        return supabase.table("templates").insert({"author_id": author_id, "title": title, "description": description, "category": category, "document_id": document_id, "price_pence": price_pence, "is_published": False}).execute().data[0]

    @staticmethod
    def publish(template_id: str, author_id: str) -> None:
        supabase.table("templates").update({"is_published": True}).eq("id", template_id).eq("author_id", author_id).execute()

    @staticmethod
    def increment_downloads(template_id: str) -> None:
        supabase.rpc("increment_template_downloads", {"template_id": template_id}).execute()
