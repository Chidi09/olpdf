import uuid
from typing import Any, Dict, List, Optional
from ..core.supabase_client import supabase


class PdfJobRepository:
    @staticmethod
    def create(owner_id: str, document_id: str, operation: str, source_object_key: str = "") -> Dict[str, Any]:
        job_id = uuid.uuid4().hex[:12]
        payload = {
            "id": job_id,
            "owner_id": owner_id,
            "document_id": document_id,
            "operation": operation,
            "status": "queued",
            "progress": 0,
            "source_object_key": source_object_key,
            "outputs": [],
        }
        supabase.table("pdf_jobs").insert(payload).execute()
        return {"id": job_id, "status": "queued", "operation": operation}

    @staticmethod
    def get_by_id(job_id: str) -> Optional[Dict[str, Any]]:
        try:
            res = supabase.table("pdf_jobs").select("*").eq("id", job_id).single().execute()
            return res.data
        except Exception:
            return None

    @staticmethod
    def update(job_id: str, updates: Dict[str, Any]) -> None:
        supabase.table("pdf_jobs").update(updates).eq("id", job_id).execute()

    @staticmethod
    def list_for_user(owner_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        try:
            res = supabase.table("pdf_jobs").select("*").eq("owner_id", owner_id).order("created_at", desc=True).limit(limit).execute()
            return res.data
        except Exception:
            return []
