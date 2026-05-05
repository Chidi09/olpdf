from typing import List
from fastapi import APIRouter, Depends, HTTPException
from ..models import PdfRedactionPayload
from ..auth_utils import require_auth
from ..export_utils import apply_true_redaction, detect_form_fields, fill_form_fields
from ..storage_client import r2_storage
from ..repositories import DocumentRepository

router = APIRouter(prefix="/api/pdf", tags=["pdf"])

def _check_ownership(doc_id: str, user: dict):
    doc = DocumentRepository.get_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("user_id") and str(doc["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")

def _download_pdf_from_storage(doc_id: str) -> bytes:
    data = r2_storage.download_bytes(f"documents/{doc_id}.pdf")
    if not data:
        raise HTTPException(status_code=404, detail="PDF not found in storage")
    return data

def _upload_pdf_to_storage(object_name: str, data: bytes) -> str:
    url = r2_storage.upload_bytes(data, f"documents/{object_name}")
    if not url:
        raise HTTPException(status_code=500, detail="Failed to upload to storage")
    return url

@router.post("/redact")
async def pdf_redact(doc_id: str, payload: PdfRedactionPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    res = _download_pdf_from_storage(doc_id)
    redacted_bytes = apply_true_redaction(res, payload.areas)
    url = _upload_pdf_to_storage(f"{doc_id}_redacted.pdf", redacted_bytes)
    return {"url": url, "status": "success"}

@router.post("/forms-detect")
async def pdf_form_detect(doc_id: str, user: dict = Depends(require_auth)) -> List[dict]:
    _check_ownership(doc_id, user)
    res = _download_pdf_from_storage(doc_id)
    return detect_form_fields(res)

@router.post("/forms-fill")
async def pdf_form_fill(doc_id: str, payload: dict, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    res = _download_pdf_from_storage(doc_id)
    filled_bytes = fill_form_fields(res, payload)
    url = _upload_pdf_to_storage(f"{doc_id}_filled.pdf", filled_bytes)
    return {"url": url, "status": "success"}
