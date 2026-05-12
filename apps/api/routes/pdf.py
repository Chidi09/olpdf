import uuid
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Request
from ..models import (
    PdfRedactionPayload,
    PdfMergePayload,
    PdfSplitPayload,
    PdfRotatePayload,
    PdfWatermarkPayload,
    PdfProtectPayload,
)
from ..auth_utils import require_auth
from ..core.auth import check_ownership as check_document_ownership, require_scopes
from ..export_utils import (
    apply_true_redaction,
    detect_form_fields,
    fill_form_fields,
    merge_pdfs,
    split_pdf,
    compress_pdf,
    rotate_pages,
    add_watermark,
    protect_pdf,
    extract_images_from_pdf,
)
from ..storage_client import r2_storage
from ..repositories import DocumentRepository
from ..repositories import AuditLogRepository

# Import limiter from limiter module
from ..limiter import limiter

router = APIRouter(prefix="/api/pdf", tags=["pdf"])

# ... helpers ...

def _check_ownership(doc_id: str, user: dict) -> dict:
    return check_document_ownership(doc_id, user)


def _download_pdf_from_storage(doc_id: str) -> bytes:
    object_name = f"documents/{doc_id}.pdf"
    pdf_bytes = r2_storage.download_bytes(object_name)
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Original PDF not found. Upload or import a PDF before running toolkit operations.")
    return pdf_bytes


def _upload_result(data: bytes, file_name: str) -> str:
    object_name = f"toolkit/{file_name}"
    url = r2_storage.upload_bytes(data, object_name)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to upload toolkit result")
    return url

@router.post("/redact")
@limiter.limit("5/minute")
async def pdf_redact(request: Request, doc_id: str, payload: PdfRedactionPayload, user: dict = Depends(require_auth)) -> dict:
    await require_scopes(["documents:write"])(user)
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    result = apply_true_redaction(pdf_bytes, payload.areas)
    url = _upload_result(result, f"{doc_id}_redacted.pdf")
    AuditLogRepository.create(
        user_id=user["sub"],
        resource_id=doc_id,
        resource_type="document",
        action="redacted",
        metadata={"area_count": len(payload.areas)},
        ip_address=request.client.host if request.client else "unknown",
    )
    return {"url": url, "status": "success"}


@router.post("/forms-detect")
@limiter.limit("10/minute")
async def pdf_form_detect(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> List[dict]:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    return detect_form_fields(pdf_bytes)


from ..security_utils import sanitize_string, sanitize_dict

@router.post("/forms-fill")
@limiter.limit("10/minute")
async def pdf_form_fill(request: Request, doc_id: str, payload: Dict[str, str], user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    # Sanitize dictionary
    safe_payload = sanitize_dict(payload)
    filled = fill_form_fields(pdf_bytes, safe_payload)
    url = _upload_result(filled, f"{doc_id}_filled.pdf")
    return {"url": url, "status": "success"}


# --- New toolkit operations ---

@router.post("/merge")
@limiter.limit("5/minute")
async def pdf_merge(request: Request, payload: PdfMergePayload, user: dict = Depends(require_auth)) -> dict:
    """Merge multiple documents into one PDF."""
    if len(payload.doc_ids) < 2:
        raise HTTPException(status_code=422, detail="At least 2 doc_ids required for merge")
    pdf_bytes_list: List[bytes] = []
    for doc_id in payload.doc_ids:
        _check_ownership(doc_id, user)
        pdf_bytes_list.append(_download_pdf_from_storage(doc_id))
    merged = merge_pdfs(pdf_bytes_list)
    out_name = f"merged_{uuid.uuid4().hex[:8]}.pdf"
    url = _upload_result(merged, out_name)
    return {"url": url, "status": "success", "page_count": len(payload.doc_ids)}


@router.post("/split")
@limiter.limit("5/minute")
async def pdf_split(request: Request, doc_id: str, payload: PdfSplitPayload, user: dict = Depends(require_auth)) -> dict:
    """Split a document into multiple PDFs by page ranges."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    ranges = [{"start": r.start, "end": r.end} for r in payload.page_ranges]
    parts = split_pdf(pdf_bytes, ranges)
    urls: List[str] = []
    for i, part_bytes in enumerate(parts):
        url = _upload_result(part_bytes, f"{doc_id}_part{i + 1}.pdf")
        urls.append(url)
    return {"urls": urls, "status": "success", "parts": len(urls)}


@router.post("/compress")
@limiter.limit("5/minute")
async def pdf_compress(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    """Compress a PDF to reduce file size."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    original_size = len(pdf_bytes)
    compressed = compress_pdf(pdf_bytes)
    url = _upload_result(compressed, f"{doc_id}_compressed.pdf")
    return {
        "url": url,
        "status": "success",
        "original_bytes": original_size,
        "compressed_bytes": len(compressed),
        "savings_pct": round((1 - len(compressed) / original_size) * 100, 1),
    }


@router.post("/rotate")
@limiter.limit("10/minute")
async def pdf_rotate(request: Request, doc_id: str, payload: PdfRotatePayload, user: dict = Depends(require_auth)) -> dict:
    """Rotate pages in a PDF."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    rotated = rotate_pages(pdf_bytes, payload.rotation, payload.page_indices)
    url = _upload_result(rotated, f"{doc_id}_rotated.pdf")
    return {"url": url, "status": "success"}


@router.post("/watermark")
@limiter.limit("10/minute")
async def pdf_watermark(request: Request, doc_id: str, payload: PdfWatermarkPayload, user: dict = Depends(require_auth)) -> dict:
    """Add a diagonal text watermark to every page."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    safe_text = sanitize_string(payload.text)
    watermarked = add_watermark(pdf_bytes, safe_text, payload.opacity)
    url = _upload_result(watermarked, f"{doc_id}_watermarked.pdf")
    return {"url": url, "status": "success"}


@router.post("/protect")
@limiter.limit("10/minute")
async def pdf_protect(request: Request, doc_id: str, payload: PdfProtectPayload, user: dict = Depends(require_auth)) -> dict:
    """Password-protect a PDF with AES-256 encryption."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    protected = protect_pdf(pdf_bytes, payload.user_password, payload.owner_password)
    url = _upload_result(protected, f"{doc_id}_protected.pdf")
    return {"url": url, "status": "success"}


@router.post("/extract-images")
@limiter.limit("5/minute")
async def pdf_extract_images(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    """Extract all embedded images from a PDF. Returns base64-encoded image data."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    images = extract_images_from_pdf(pdf_bytes)
    return {"images": images, "count": len(images), "status": "success"}
