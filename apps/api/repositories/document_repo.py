from typing import Any, Dict, List, Optional
from ..core.supabase_client import supabase
from ..services.cache_service import cache_or_fetch, delete


class DocumentRepository:
    @staticmethod
    def get_by_id(doc_id: str) -> Optional[Dict[str, Any]]:
        return cache_or_fetch(
            f"doc:{doc_id}",
            lambda: _get_doc_by_id(doc_id),
            ttl=60,
        )

    @staticmethod
    def list_for_user(user_id: str, offset: int = 0, limit: int = 50) -> List[Dict[str, Any]]:
        try:
            return (
                supabase.table("documents")
                .select("id, title, status, created_at, updated_at, document_model")
                .or_(f"user_id.eq.{user_id},document_model->>owner_id.eq.{user_id}")
                .neq("status", "deleted")
                .order("updated_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
                .data
            )
        except Exception:
            return []

    @staticmethod
    def create(title: str, model: Dict[str, Any], status: str = "ready", user_id: Optional[str] = None, workspace_id: Optional[str] = None) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"title": title, "document_model": model, "status": status}
        if user_id:
            payload["user_id"] = user_id
            payload["document_model"]["owner_id"] = user_id
        if workspace_id:
            payload["workspace_id"] = workspace_id
        try:
            return supabase.table("documents").insert(payload).execute().data[0]
        except Exception as e:
            if "violates foreign key constraint" in str(e):
                payload["user_id"] = None
                return supabase.table("documents").insert(payload).execute().data[0]
            raise

    @staticmethod
    def update(doc_id: str, updates: Dict[str, Any]) -> None:
        supabase.table("documents").update(updates).eq("id", doc_id).execute()
        delete(f"doc:{doc_id}")

    @staticmethod
    def delete(doc_id: str) -> None:
        DocumentRepository.update(doc_id, {"status": "deleted"})

    @staticmethod
    def hard_delete(doc_id: str) -> None:
        supabase.table("documents").delete().eq("id", doc_id).execute()

    @staticmethod
    def create_log(doc_id: str, instruction: str, tool_calls: List[Dict], diff: Dict, status: str = "pending_review") -> Dict[str, Any]:
        return supabase.table("ai_edit_logs").insert({"document_id": doc_id, "instruction": instruction, "tool_calls": tool_calls, "diff_snapshot": diff, "status": status}).execute().data[0]

    @staticmethod
    def get_logs(doc_id: str) -> List[Dict[str, Any]]:
        return supabase.table("ai_edit_logs").select("*").eq("document_id", doc_id).order("created_at", desc=True).execute().data

    @staticmethod
    def get_log_by_id(log_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("ai_edit_logs").select("*").eq("id", log_id).single().execute()
        return res.data

    @staticmethod
    def update_log(log_id: str, updates: Dict[str, Any]) -> None:
        supabase.table("ai_edit_logs").update(updates).eq("id", log_id).execute()


def _get_doc_by_id(doc_id: str) -> Optional[Dict[str, Any]]:
    res = supabase.table("documents").select("*").eq("id", doc_id).neq("status", "deleted").single().execute()
    return res.data
