import secrets
import asyncio
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from ..models import SignatureRequestPayload, SignatureSubmitPayload
from ..auth_utils import require_auth, check_ownership, require_scopes
from ..repositories import AuditLogRepository
from ..supabase_client import supabase_admin, supabase
from ..notification_utils import send_email, APP_URL
from ..webhook_utils import dispatch_webhook

router = APIRouter(prefix="/api/signatures", tags=["signatures"])

@router.post("/request")
async def create_signature_request(payload: SignatureRequestPayload, user: dict = Depends(require_auth)) -> dict:
    await require_scopes(["documents:write"])(user)
    # Verify document ownership
    doc = check_ownership(payload.document_id, user)
    doc_title = doc.get("title", "Document")

    # Create request
    req_res = supabase.table("signature_requests").insert({
        "document_id": payload.document_id,
        "requester_id": user["sub"]
    }).execute()
    req_id = req_res.data[0]["id"]
    AuditLogRepository.create(
        user_id=user["sub"],
        resource_id=str(req_id),
        resource_type="signature_request",
        action="created",
        metadata={"document_id": payload.document_id, "signer_count": len(payload.signers)},
    )
    
    # Create fields & email signers
    for email in payload.signers:
        token = secrets.token_urlsafe(32)
        supabase_admin.table("signature_fields").insert({
            "request_id": req_id,
            "signer_email": email,
            "token": token
        }).execute()
        
        # Email signer
        subject = f"Signature requested: {doc_title}"
        link = f"{APP_URL}/sign/{token}"
        # Hardcoding the body for brevity here. A full implementation would use Jinja2.
        html_body = f"<h2>Signature Request</h2><p>You have been asked to sign <strong>{doc_title}</strong>.</p><a href='{link}'>Review and Sign</a>"
        send_email(email, subject, html_body, f"Sign here: {link}")
        
    return {"status": "success", "request_id": req_id}

@router.post("/sign/{token}")
async def submit_signature(request: Request, token: str, payload: SignatureSubmitPayload) -> dict:
    # Use admin to find field since signer may not be authenticated
    res = supabase_admin.table("signature_fields").select("*").eq("token", token).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
        
    if res.data.get("signed_at"):
        raise HTTPException(status_code=400, detail="Already signed")
        
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
        
    # Update field
    supabase_admin.table("signature_fields").update({
        "signature_data": payload.signature_data,
        "signed_at": "now()",
        "ip_address": client_ip,
        "user_agent": user_agent
    }).eq("token", token).execute()
    
    # Check if all fields for this request are signed
    req_id = res.data["request_id"]
    fields_res = supabase_admin.table("signature_fields").select("signed_at").eq("request_id", req_id).execute()
    
    all_signed = all(f.get("signed_at") for f in fields_res.data)
    if all_signed:
        supabase_admin.table("signature_requests").update({"status": "completed"}).eq("id", req_id).execute()
        # Fire webhook asynchronously
        req_data = supabase_admin.table("signature_requests").select("requester_id").eq("id", req_id).single().execute()
        AuditLogRepository.create(
            user_id=req_data.data["requester_id"],
            resource_id=str(req_id),
            resource_type="signature_request",
            action="completed",
            metadata={"ip_address": client_ip},
            ip_address=client_ip,
        )
        asyncio.create_task(dispatch_webhook("signature.completed", {"request_id": req_id}, req_data.data["requester_id"]))
        
    return {"status": "success"}
