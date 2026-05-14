from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Request

from ..auth_utils import require_auth, check_ownership
from ..limiter import limiter
from ..repositories.pdf_job_repo import PdfJobRepository
from ..core.auth import verify_worker_secret

router = APIRouter(prefix="/api/pdf-jobs", tags=["pdf-jobs"])


@router.post("")
@limiter.limit("30/minute")
async def create_pdf_job(request: Request, payload: Dict[str, Any], user: dict = Depends(require_auth)) -> dict:
    document_id = str(payload.get("document_id", ""))
    operation = str(payload.get("operation", ""))
    if not document_id or not operation:
        raise HTTPException(status_code=422, detail="document_id and operation are required")

    check_ownership(document_id, user)
    source_object_key = f"documents/{document_id}.pdf"
    job = PdfJobRepository.create(
        owner_id=user["sub"],
        document_id=document_id,
        operation=operation,
        source_object_key=source_object_key,
    )
    return job


@router.get("/{job_id}")
@limiter.limit("60/minute")
async def get_pdf_job(request: Request, job_id: str, user: dict = Depends(require_auth)) -> dict:
    job = PdfJobRepository.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("owner_id") != user["sub"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return job


@router.patch("/{job_id}")
async def update_pdf_job(request: Request, job_id: str, payload: Dict[str, Any]) -> dict:
    verify_worker_secret(request)
    job = PdfJobRepository.get_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    allowed_updates = {"status", "progress", "message", "outputs", "error"}
    updates = {k: v for k, v in payload.items() if k in allowed_updates}
    if not updates:
        raise HTTPException(status_code=422, detail="No valid fields to update")

    PdfJobRepository.update(job_id, updates)
    return {"id": job_id, "status": "updated"}
