from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from ..models import AiInstructionPayload
from ..repositories import DocumentRepository
from ..auth_utils import require_auth, check_ownership
from ..ai_utils import execute_ai_instruction
from ..services.ai_service import chat_with_document, summarise_document, detect_pii
from ..supabase_client import supabase
from ..security_utils import sanitize_string

# Import limiter from limiter module
from ..limiter import limiter

router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.get("/documents/{document_id}/logs")
async def get_ai_logs(document_id: str, user: dict = Depends(require_auth)) -> List[dict]:
    check_ownership(document_id, user)
    return DocumentRepository.get_logs(document_id)

@router.post("/documents/{document_id}/instruction")
@limiter.limit("5/minute")
async def ai_instruction(request: Request, document_id: str, payload: AiInstructionPayload, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    instruction = sanitize_string(payload.instruction)
    return await execute_ai_instruction(document_id, instruction)


@router.post("/documents/{document_id}/chat")
@limiter.limit("10/minute")
async def ai_chat(request: Request, document_id: str, payload: AiInstructionPayload, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    message = sanitize_string(payload.instruction)
    return await chat_with_document(document_id, message)


@router.post("/documents/{document_id}/summarise")
@limiter.limit("5/minute")
async def ai_summarise(request: Request, document_id: str, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    result = await summarise_document(document_id)
    return {"summary": result.get("updated_model", {}).get("blocks", [])[:2], "log_id": result.get("log_id")}


@router.post("/documents/{document_id}/detect-pii")
@limiter.limit("10/minute")
async def ai_detect_pii(request: Request, document_id: str, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    return await detect_pii(document_id)

@router.post("/logs/{log_id}/accept")
async def accept_ai_edit(log_id: str, user: dict = Depends(require_auth)) -> dict:
    res = supabase.table("ai_edit_logs").select("*").eq("id", log_id).single().execute()
    log = res.data
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    check_ownership(log["document_id"], user)
    
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
    check_ownership(log["document_id"], user)
    
    DocumentRepository.update_log(log_id, {"status": "rejected"})
    return {"status": "success"}
