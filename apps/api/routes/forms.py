from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from ..auth_utils import require_auth, check_ownership, require_scopes
from ..repositories import DocumentRepository
from ..repositories import AuditLogRepository
from ..export_utils import detect_form_fields, fill_form_fields
from ..core.storage_client import r2_storage
from ..webhook_utils import dispatch_webhook
import asyncio

router = APIRouter(prefix="/api/forms", tags=["forms"])

@router.post("/{doc_id}/detect")
async def detect_forms(doc_id: str, user: dict = Depends(require_auth)) -> List[Dict[str, Any]]:
    await require_scopes(["forms:write"])(user)
    doc = check_ownership(doc_id, user)
    # Get PDF from storage
    object_name = f"uploads/{doc_id}.pdf"
    pdf_bytes = r2_storage.download_bytes(object_name)
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Original PDF not found")
        
    fields = detect_form_fields(pdf_bytes)
    
    # Save fields to DB
    from ..supabase_client import supabase_admin
    # First clear existing fields
    supabase_admin.table("form_fields").delete().eq("document_id", doc_id).execute()
    
    for f in fields:
        supabase_admin.table("form_fields").insert({
            "document_id": doc_id,
            "label": f.get("label", f.get("name", "Field")),
            "field_type": f.get("type", "text"),
            "bounding_box": f.get("bbox", [0,0,0,0]),
            "page_index": f.get("page", 0)
        }).execute()
    AuditLogRepository.create(
        user_id=user["sub"],
        resource_id=doc_id,
        resource_type="form",
        action="fields_detected",
        metadata={"field_count": len(fields)},
    )
        
    return fields

@router.get("/{doc_id}/fields")
async def list_form_fields(doc_id: str, user: dict = Depends(require_auth)) -> List[Dict[str, Any]]:
    await require_scopes(["forms:read"])(user)
    check_ownership(doc_id, user)
    from ..supabase_client import supabase
    res = supabase.table("form_fields").select("*").eq("document_id", doc_id).execute()
    return res.data

@router.post("/{doc_id}/submit")
async def submit_form(doc_id: str, data: Dict[str, Any], request: Request, user: dict = Depends(require_auth)) -> dict:
    await require_scopes(["forms:write"])(user)
    # Public forms might not require auth, but for now we follow the plan
    check_ownership(doc_id, user)
    
    from ..supabase_client import supabase_admin
    res = supabase_admin.table("form_submissions").insert({
        "document_id": doc_id,
        "data": data,
        "signer_id": user["sub"],
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown")
    }).execute()
    
    submission_id = res.data[0]["id"]
    AuditLogRepository.create(
        user_id=user["sub"],
        resource_id=str(submission_id),
        resource_type="form_submission",
        action="submitted",
        metadata={"document_id": doc_id},
        ip_address=request.client.host if request.client else "unknown",
    )
    
    # Fire webhook
    asyncio.create_task(dispatch_webhook("form.submission_received", {"submission_id": submission_id, "document_id": doc_id}, user["sub"]))
    
    return {"status": "success", "submission_id": submission_id}
