from typing import Any, Dict, List, Optional
from ..core.supabase_client import supabase


class BookRepository:
    @staticmethod
    def get_by_id(book_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("books").select("*").eq("id", book_id).single().execute()
        return res.data

    @staticmethod
    def get_chapters(book_id: str) -> List[Dict[str, Any]]:
        return supabase.table("book_chapters").select("*").eq("book_id", book_id).order("sort_order").execute().data

    @staticmethod
    def create(title: str, meta: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"title": title, "meta": meta}
        if user_id:
            payload["user_id"] = user_id
        return supabase.table("books").insert(payload).execute().data[0]

    @staticmethod
    def update(book_id: str, updates: Dict[str, Any]) -> None:
        supabase.table("books").update(updates).eq("id", book_id).execute()

    @staticmethod
    def create_chapter(book_id: str, doc_id: str, title: str, chapter_number: int) -> Dict[str, Any]:
        return supabase.table("book_chapters").insert({"book_id": book_id, "document_id": doc_id, "title": title, "chapter_number": chapter_number, "sort_order": chapter_number, "status": "draft"}).execute().data[0]

    @staticmethod
    def update_chapter(chapter_id: str, updates: Dict[str, Any]) -> None:
        supabase.table("book_chapters").update(updates).eq("id", chapter_id).execute()

    @staticmethod
    def delete_chapter(chapter_id: str) -> None:
        supabase.table("book_chapters").delete().eq("id", chapter_id).execute()
