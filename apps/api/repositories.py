from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
from .supabase_client import supabase

class DocumentRepository:
    @staticmethod
    def get_by_id(doc_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("documents").select("*").eq("id", doc_id).single().execute()
        return res.data

    @staticmethod
    def create(title: str, model: Dict[str, Any], status: str = "ready") -> Dict[str, Any]:
        res = supabase.table("documents").insert({
            "title": title,
            "document_model": model,
            "status": status
        }).execute()
        return res.data[0]

    @staticmethod
    def update(doc_id: str, updates: Dict[str, Any]) -> None:
        supabase.table("documents").update(updates).eq("id", doc_id).execute()

    @staticmethod
    def delete(doc_id: str) -> None:
        supabase.table("documents").delete().eq("id", doc_id).execute()

    @staticmethod
    def create_log(doc_id: str, instruction: str, tool_calls: List[Dict], diff: Dict, status: str = "pending_review") -> Dict[str, Any]:
        res = supabase.table("ai_edit_logs").insert({
            "document_id": doc_id,
            "instruction": instruction,
            "tool_calls": tool_calls,
            "diff_snapshot": diff,
            "status": status
        }).execute()
        return res.data[0]

    @staticmethod
    def get_logs(doc_id: str) -> List[Dict[str, Any]]:
        res = supabase.table("ai_edit_logs").select("*").eq("document_id", doc_id).order("created_at", desc=True).execute()
        return res.data

    @staticmethod
    def get_log_by_id(log_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("ai_edit_logs").select("*").eq("id", log_id).single().execute()
        return res.data

    @staticmethod
    def update_log(log_id: str, updates: Dict[str, Any]) -> None:
        supabase.table("ai_edit_logs").update(updates).eq("id", log_id).execute()

class BookRepository:
    @staticmethod
    def get_by_id(book_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("books").select("*").eq("id", book_id).single().execute()
        return res.data

    @staticmethod
    def get_chapters(book_id: str) -> List[Dict[str, Any]]:
        res = supabase.table("book_chapters").select("*").eq("book_id", book_id).order("sort_order").execute()
        return res.data

    @staticmethod
    def create(title: str, meta: Dict[str, Any]) -> Dict[str, Any]:
        res = supabase.table("books").insert({
            "title": title,
            "meta": meta
        }).execute()
        return res.data[0]

    @staticmethod
    def update(book_id: str, updates: Dict[str, Any]) -> None:
        supabase.table("books").update(updates).eq("id", book_id).execute()

    @staticmethod
    def create_chapter(book_id: str, doc_id: str, title: str, chapter_number: int) -> Dict[str, Any]:
        res = supabase.table("book_chapters").insert({
            "book_id": book_id,
            "document_id": doc_id,
            "title": title,
            "chapter_number": chapter_number,
            "sort_order": chapter_number,
            "status": "draft"
        }).execute()
        return res.data[0]

    @staticmethod
    def update_chapter(chapter_id: str, updates: Dict[str, Any]) -> None:
        supabase.table("book_chapters").update(updates).eq("id", chapter_id).execute()

    @staticmethod
    def delete_chapter(chapter_id: str) -> None:
        supabase.table("book_chapters").delete().eq("id", chapter_id).execute()

class TemplateRepository:
    @staticmethod
    def list_all() -> List[Dict[str, Any]]:
        res = supabase.table("templates").select("*").order("created_at", desc=True).execute()
        return res.data or []

    @staticmethod
    def get_by_id(template_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("templates").select("*").eq("id", template_id).single().execute()
        return res.data
