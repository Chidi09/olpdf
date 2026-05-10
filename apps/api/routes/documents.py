from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from ..models import DocumentModel, DocumentSnapshotPayload, VersionHistoryEntry, ImportStartPayload
from ..repositories import DocumentRepository
from ..auth_utils import require_auth, check_ownership
from ..security_utils import sanitize_document_model
from ..factories import ExportEngineFactory
from ..export_utils import run_preflight
from ..storage_client import r2_storage
from ..worker_utils import route_pdf_import

# Import limiter from limiter module
from ..limiter import limiter

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("/import/start")
@limiter.limit("5/minute")
async def start_import(request: Request, payload: ImportStartPayload, background_tasks: BackgroundTasks, user: dict = Depends(require_auth)) -> dict:
    check_ownership(payload.document_id, user)
    
    request_id = request.headers.get("X-Request-ID", "")
    
    # 1. Update document status in DB
    DocumentRepository.update(payload.document_id, {"status": "processing", "import_progress": 0})
    
    # 2. Upload to storage
    object_name = f"documents/{payload.document_id}.pdf"
    storage_url = r2_storage.upload_bytes(payload.file_bytes, object_name)
    if not storage_url:
        raise HTTPException(status_code=500, detail="Failed to upload PDF to storage")
    
    # 3. Process import in background
    background_tasks.add_task(route_pdf_import, payload.file_bytes, payload.document_id, payload.layout_mode, request_id)
    
    return {"id": payload.document_id, "status": "queued", "storage_url": storage_url}

@router.get("/import/{job_id}/status")
async def get_import_status(job_id: str, user: dict = Depends(require_auth)) -> dict:
    doc = check_ownership(job_id, user)
    return {
        "id": job_id,
        "status": doc.get("status", "unknown"),
        "import_progress": doc.get("import_progress", 0),
        "error": doc.get("error")
    }

@router.get("")
async def list_documents(user: dict = Depends(require_auth)) -> List[dict]:
    return DocumentRepository.list_for_user(user["sub"])

from ..repositories import DocumentRepository, AuditLogRepository

@router.post("/create")
@limiter.limit("10/minute")
async def create_document(request: Request, doc: DocumentModel, user: dict = Depends(require_auth)) -> dict:
    payload = sanitize_document_model(doc.model_dump())
    payload["user_id"] = user["sub"]
    title = payload.get("meta", {}).get("title", "Untitled Document")
    new_doc = DocumentRepository.create(title, payload)

    AuditLogRepository.create(
        user_id=user["sub"],
        resource_id=new_doc["id"],
        resource_type="document",
        action="created",
        ip_address=request.client.host if request.client else "unknown"
    )

    return {"id": new_doc["id"], "status": "created"}

@router.get("/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(require_auth)) -> dict:
    doc = check_ownership(doc_id, user)
    return {
        "id": doc_id, 
        "document_model": doc["document_model"],
        "workspace_id": str(doc.get("workspace_id")) if doc.get("workspace_id") else None
    }

@router.get("/{doc_id}/preview")
async def get_document_preview(doc_id: str, user: dict = Depends(require_auth)) -> dict:
    check_ownership(doc_id, user)
    object_name = f"documents/{doc_id}.pdf"
    url = r2_storage.generate_presigned_url(object_name)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate preview URL")
    return {"id": doc_id, "preview_url": url, "status": "ready"}

@router.put("/{doc_id}")
async def update_document(doc_id: str, doc: DocumentModel, user: dict = Depends(require_auth)) -> dict:
    check_ownership(doc_id, user)
        
    sanitized = sanitize_document_model(doc.model_dump())
    DocumentRepository.update(doc_id, {"title": doc.meta.title, "document_model": sanitized})
    return {"id": doc_id, "status": "success"}

@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(require_auth)) -> dict:
    check_ownership(doc_id, user)
    DocumentRepository.delete(doc_id)
    return {"id": doc_id, "status": "deleted"}

@router.post("/{doc_id}/export/{format_type}")
@limiter.limit("5/minute")
async def export_document(request: Request, doc_id: str, format_type: str, doc: DocumentModel, user: dict = Depends(require_auth)) -> dict:
    check_ownership(doc_id, user)
    try:
        format_alias = {
            "pdf": "standard",
            "pdfa": "pdf_a",
            "text": "txt",
        }
        normalized_format = format_alias.get(format_type, format_type)
        doc_dict = doc.model_dump()
        if normalized_format == "fidelity" or doc.meta.layout_mode == "fidelity":
            from ..reflow_engine import reflow_document

            doc_dict = reflow_document(doc_dict)

        engine = ExportEngineFactory.get_engine(normalized_format)
        
        if normalized_format == "fidelity":
            color_space = doc.meta.color_space if hasattr(doc.meta, "color_space") else "rgb"
            pdf_bytes = engine(doc_dict, color_space=color_space)
        else:
            pdf_bytes = engine(doc_dict)

        object_name = f"exports/{doc_id}.{normalized_format}"
        url = r2_storage.upload_bytes(pdf_bytes, object_name)

        # Best-effort email notification
        try:
            from ..notification_utils import send_export_ready_notification
            send_export_ready_notification(
                user_id=user["sub"],
                doc_title=doc.meta.title,
                export_url=url,
                format_type=normalized_format,
            )
        except Exception:
            pass

        return {"id": doc_id, "url": url, "size": len(pdf_bytes), "format": normalized_format}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{doc_id}/preflight")
async def document_preflight(doc_id: str, doc: DocumentModel, user: dict = Depends(require_auth)) -> List[dict]:
    check_ownership(doc_id, user)
    return run_preflight(doc.model_dump())

@router.post("/{document_id}/snapshot")
async def create_document_snapshot(document_id: str, payload: DocumentSnapshotPayload, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    DocumentRepository.create_log(document_id, f"Snapshot: {payload.version_name or 'Auto'}", [], {"after": payload.document_model.blocks}, "version_snapshot")
    return {"status": "success"}

@router.get("/{document_id}/versions", response_model=List[VersionHistoryEntry])
async def get_document_versions(document_id: str, user: dict = Depends(require_auth)) -> List[VersionHistoryEntry]:
    check_ownership(document_id, user)
    logs = DocumentRepository.get_logs(document_id)
    return [l for l in logs if l["status"] == "version_snapshot"]
