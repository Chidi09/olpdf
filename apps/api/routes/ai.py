from typing import List
from fastapi import APIRouter, Depends, HTTPException
from ..models import AiInstructionPayload
from ..repositories import DocumentRepository
from ..auth_utils import require_auth
from ..ai_utils import execute_ai_instruction
from ..supabase_client import supabase

router = APIRouter(prefix="/api/ai", tags=["ai"])

def _check_doc_ownership(doc_id: str, user: dict):
    doc = DocumentRepository.get_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("user_id") and str(doc["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")

@router.get("/documents/{document_id}/logs")
async def get_ai_logs(document_id: str, user: dict = Depends(require_auth)) -> List[dict]:
    _check_doc_ownership(document_id, user)
    return DocumentRepository.get_logs(document_id)

@router.post("/documents/{document_id}/instruction")
async def ai_instruction(document_id: str, payload: AiInstructionPayload, user: dict = Depends(require_auth)) -> dict:
    _check_doc_ownership(document_id, user)
    return await execute_ai_instruction(document_id, payload.instruction)

@router.post("/logs/{log_id}/accept")
async def accept_ai_edit(log_id: str, user: dict = Depends(require_auth)) -> dict:
    res = supabase.table("ai_edit_logs").select("*").eq("id", log_id).single().execute()
    log = res.data
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    _check_doc_ownership(log["document_id"], user)
    
    doc = DocumentRepository.get_by_id(log["document_id"])
    model = doc["document_model"]
    model["blocks"] = log["diff_snapshot"]["after"]
    DocumentRepository.update(log["document_id"], {"document_model": model})
    DocumentRepository.update_log(log_id, {"status": "accepted"})
    return {"status": "success"}

@router.post("/logs/{log_id}/reject")
async def reject_ai_edit(log_id: str, user: dict = Depends(require_auth)) -> dict:
    res = supabase.table("ai_edit_logs").select("*").eq("id", log_id).single().execute()
    log = res.data
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    _check_doc_ownership(log["document_id"], user)
    
    DocumentRepository.update_log(log_id, {"status": "rejected"})
    return {"status": "success"}
