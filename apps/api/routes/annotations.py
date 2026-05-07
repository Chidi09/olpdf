from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from ..auth_utils import require_auth, check_ownership
from ..supabase_client import supabase

router = APIRouter(prefix="/api/annotations", tags=["annotations"])


@router.get("/{document_id}")
async def list_annotations(document_id: str, user: dict = Depends(require_auth)) -> List[Dict[str, Any]]:
    check_ownership(document_id, user)
    res = supabase.table("annotations").select("*").eq("document_id", document_id).order("created_at").execute()
    return res.data or []


@router.post("/{document_id}")
async def create_annotation(document_id: str, payload: Dict[str, Any], user: dict = Depends(require_auth)) -> Dict[str, Any]:
    check_ownership(document_id, user)
    row = {
        "document_id": document_id,
        "created_by": user["sub"],
        "page_number": int(payload.get("page_number", 1)),
        "position": payload.get("position", {"x": 0, "y": 0, "width": 0, "height": 0}),
        "content": str(payload.get("content", "")),
        "annotation_type": str(payload.get("annotation_type", "comment")),
        "parent_id": payload.get("parent_id"),
    }
    res = supabase.table("annotations").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create annotation")
    return res.data[0]


@router.patch("/{annotation_id}/resolve")
async def resolve_annotation(annotation_id: str, user: dict = Depends(require_auth)) -> Dict[str, str]:
    res = supabase.table("annotations").select("document_id").eq("id", annotation_id).single().execute()
    data = res.data
    if not data:
        raise HTTPException(status_code=404, detail="Annotation not found")
    check_ownership(str(data["document_id"]), user)
    supabase.table("annotations").update({"resolved": True}).eq("id", annotation_id).execute()
    return {"status": "success"}
