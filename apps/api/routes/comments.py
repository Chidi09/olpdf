from typing import Optional, Dict, Any, List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth_utils import require_auth, check_ownership
from ..supabase_client import supabase

router = APIRouter(prefix="/api/documents/{doc_id}/comments", tags=["comments"])


class CommentCreate(BaseModel):
    block_id: Optional[str] = None
    page_index: int
    anchor: Optional[Dict[str, Any]] = None
    position: Dict[str, Any]
    body: str
    parent_id: Optional[str] = None


@router.get("/")
async def list_comments(doc_id: str, user: dict = Depends(require_auth)) -> List[Dict[str, Any]]:
    check_ownership(doc_id, user)
    try:
        res = (
            supabase.table("document_comments")
            .select("*")
            .eq("document_id", doc_id)
            .order("created_at")
            .execute()
        )
        return res.data or []
    except Exception:
        return []


@router.post("/")
async def create_comment(doc_id: str, payload: CommentCreate, user: dict = Depends(require_auth)) -> Dict[str, Any]:
    check_ownership(doc_id, user)
    res = (
        supabase.table("document_comments")
        .insert(
            {
                "id": str(uuid.uuid4()),
                "document_id": doc_id,
                "created_by": user["sub"],
                "block_id": payload.block_id,
                "page_index": payload.page_index,
                "anchor": payload.anchor,
                "position": payload.position,
                "body": payload.body,
                "parent_id": payload.parent_id,
            }
        )
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create comment")
    return res.data[0]


@router.patch("/{comment_id}/resolve")
async def resolve_comment(doc_id: str, comment_id: str, user: dict = Depends(require_auth)) -> Dict[str, bool]:
    check_ownership(doc_id, user)
    supabase.table("document_comments").update({"resolved": True}).eq("id", comment_id).eq("document_id", doc_id).execute()
    return {"ok": True}


@router.delete("/{comment_id}")
async def delete_comment(doc_id: str, comment_id: str, user: dict = Depends(require_auth)) -> Dict[str, bool]:
    check_ownership(doc_id, user)
    supabase.table("document_comments").delete().eq("id", comment_id).eq("document_id", doc_id).execute()
    return {"ok": True}
