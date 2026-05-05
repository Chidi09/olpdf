from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from ..models import DocumentModel, DocumentSnapshotPayload, VersionHistoryEntry, ImportStartPayload
from ..repositories import DocumentRepository
from ..auth_utils import require_auth
from ..security_utils import sanitize_document_model
from ..factories import ExportEngineFactory
from ..export_utils import run_preflight
from ..storage_client import r2_storage
from ..worker_utils import route_pdf_import

router = APIRouter(prefix="/api/documents", tags=["documents"])

def _check_doc_ownership(doc_id: str, user: dict):
    doc = DocumentRepository.get_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("user_id") and str(doc["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")

@router.post("/import/start")
async def start_import(payload: ImportStartPayload, background_tasks: BackgroundTasks, user: dict = Depends(require_auth)) -> dict:
    _check_doc_ownership(payload.document_id, user)
    
    # 1. Update document status in DB
    DocumentRepository.update(payload.document_id, {"status": "processing", "import_progress": 0})
    
    # 2. Upload to storage
    object_name = f"documents/{payload.document_id}.pdf"
    storage_url = r2_storage.upload_bytes(payload.file_bytes, object_name)
    if not storage_url:
        raise HTTPException(status_code=500, detail="Failed to upload PDF to storage")
    
    # 3. Process import in background
    background_tasks.add_task(route_pdf_import, payload.file_bytes, payload.document_id)
    
    return {"id": payload.document_id, "status": "queued", "storage_url": storage_url}

@router.get("/import/{job_id}/status")
async def get_import_status(job_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_doc_ownership(job_id, user)
    doc = DocumentRepository.get_by_id(job_id)
    return {
        "id": job_id,
        "status": doc.get("status", "unknown"),
        "import_progress": doc.get("import_progress", 0),
        "error": doc.get("error")
    }

@router.post("/create")
async def create_document(doc: DocumentModel, user: dict = Depends(require_auth)) -> dict:
    payload = sanitize_document_model(doc.model_dump())
    payload["user_id"] = user["sub"]
    title = payload.get("meta", {}).get("title", "Untitled Document")
    new_doc = DocumentRepository.create(title, payload)
    return {"id": new_doc["id"], "status": "created"}

@router.get("/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(require_auth)) -> dict:
    doc = DocumentRepository.get_by_id(doc_id)
    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("user_id") and str(doc["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"id": doc_id, "document_model": doc["document_model"]}

@router.get("/{doc_id}/preview")
async def get_document_preview(doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_doc_ownership(doc_id, user)
    object_name = f"documents/{doc_id}.pdf"
    url = r2_storage.generate_presigned_url(object_name)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate preview URL")
    return {"id": doc_id, "preview_url": url, "status": "ready"}

@router.put("/{doc_id}")
async def update_document(doc_id: str, doc: DocumentModel, user: dict = Depends(require_auth)) -> dict:
    existing = DocumentRepository.get_by_id(doc_id)
    if existing and existing.get("user_id") and str(existing["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")
        
    sanitized = sanitize_document_model(doc.model_dump())
    DocumentRepository.update(doc_id, {"title": doc.meta.title, "document_model": sanitized})
    return {"id": doc_id, "status": "success"}

@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(require_auth)) -> dict:
    existing = DocumentRepository.get_by_id(doc_id)
    if existing and existing.get("user_id") and str(existing["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")
        
    DocumentRepository.delete(doc_id)
    return {"id": doc_id, "status": "deleted"}

@router.post("/{doc_id}/export/{format_type}")
async def export_document(doc_id: str, format_type: str, doc: DocumentModel, user: dict = Depends(require_auth)) -> dict:
    _check_doc_ownership(doc_id, user)
    try:
        engine = ExportEngineFactory.get_engine(format_type)
        pdf_bytes = engine(doc.model_dump())
        
        # Upload to storage
        object_name = f"exports/{doc_id}.{format_type}"
        url = r2_storage.upload_bytes(pdf_bytes, object_name)
        
        return {"id": doc_id, "url": url, "size": len(pdf_bytes)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{doc_id}/preflight")
async def document_preflight(doc_id: str, doc: DocumentModel, user: dict = Depends(require_auth)) -> List[dict]:
    return run_preflight(doc.model_dump())

@router.post("/{document_id}/snapshot")
async def create_document_snapshot(document_id: str, payload: DocumentSnapshotPayload, user: dict = Depends(require_auth)) -> dict:
    DocumentRepository.create_log(document_id, f"Snapshot: {payload.version_name or 'Auto'}", [], {"after": payload.document_model.blocks}, "version_snapshot")
    return {"status": "success"}

@router.get("/{document_id}/versions", response_model=List[VersionHistoryEntry])
async def get_document_versions(document_id: str, user: dict = Depends(require_auth)) -> List[VersionHistoryEntry]:
    logs = DocumentRepository.get_logs(document_id)
    return [l for l in logs if l["status"] == "version_snapshot"]
