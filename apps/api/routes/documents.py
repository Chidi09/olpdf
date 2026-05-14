from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
)

from ..auth_utils import check_ownership, require_auth
from ..core.auth import ensure_profile_row
from ..core.storage_client import r2_storage
from ..core.supabase_client import supabase
from ..engine.normalizer import normalize_document_model as normalize_model
from ..export_utils import run_preflight
from ..factories import ExportEngineFactory

# Import limiter from limiter module
from ..limiter import limiter
from ..models import (
    DocumentModel,
    DocumentSnapshotPayload,
    ExportRequest,
    ImportStartPayload,
    VersionHistoryEntry,
)
from ..repositories import DocumentRepository
from ..security_utils import sanitize_document_model
from ..worker_utils import route_pdf_import
from ..workers.tasks.export_tasks import EXPORT_SERVICE_URL, WORKER_SECRET

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.patch("/{doc_id}/title")
async def update_document_title(
    doc_id: str, payload: Dict[str, Any], user: dict = Depends(require_auth)
) -> dict:
    check_ownership(doc_id, user)
    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    DocumentRepository.update(doc_id, {"title": title})
    return {"id": doc_id, "status": "success", "title": title}


@router.post("/import/start")
@limiter.limit("5/minute")
async def start_import(
    request: Request,
    payload: ImportStartPayload,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_auth),
) -> dict:
    check_ownership(payload.document_id, user)

    request_id = request.headers.get("X-Request-ID", "")

    # 1. Update document status in DB
    DocumentRepository.update(
        payload.document_id, {"status": "processing", "import_progress": 0}
    )

    # 2. Upload to storage
    object_name = f"documents/{payload.document_id}.pdf"
    storage_url = r2_storage.upload_bytes(payload.file_bytes, object_name)
    if not storage_url:
        raise HTTPException(status_code=500, detail="Failed to upload PDF to storage")

    # 3. Mark document as native PDF and persist original key
    DocumentRepository.update(
        payload.document_id,
        {
            "document_model": {
                "meta": {
                    "original_pdf_key": object_name,
                    "native_pdf": True,
                    "layout_mode": payload.layout_mode,
                },
                "blocks": [],
                "page_dimensions": [],
                "styles": {},
            }
        },
    )

    # 4. If client_model provided, save it immediately so editor can open instantly
    if payload.client_model:
        try:
            existing = DocumentRepository.find_by_id(payload.document_id)
            merged_model = (existing.get("document_model") or {}) if existing else {}
            merged_model["blocks"] = payload.client_model.get("blocks", [])
            merged_model["page_dimensions"] = payload.client_model.get(
                "page_dimensions", []
            )
            # Preserve client_model meta (e.g. native_pdf_session from WASM parser)
            client_meta = payload.client_model.get("meta") or {}
            existing_meta = merged_model.get("meta") or {}
            merged_model["meta"] = {**existing_meta, **client_meta}
            DocumentRepository.update(
                payload.document_id, {"document_model": merged_model}
            )
        except Exception:
            pass  # non-critical; background enrichment will fill in

    # 5. Process import in background
    background_tasks.add_task(
        route_pdf_import,
        payload.file_bytes,
        payload.document_id,
        payload.layout_mode,
        request_id,
    )

    return {"id": payload.document_id, "status": "queued", "storage_url": storage_url}


@router.get("/import/{job_id}/status")
async def get_import_status(job_id: str, user: dict = Depends(require_auth)) -> dict:
    doc = check_ownership(job_id, user)
    return {
        "id": job_id,
        "status": doc.get("status", "unknown"),
        "import_progress": doc.get("import_progress", 0),
        "error": doc.get("error"),
    }


@router.get("")
async def list_documents(
    page: int = 0, limit: int = 50, user: dict = Depends(require_auth)
) -> dict:
    docs = DocumentRepository.list_for_user(
        user["sub"], offset=page * limit, limit=limit
    )
    return {"documents": docs, "page": page, "limit": limit}


from ..core.cache import cache_get
from ..core.cache_keys import export_status as export_status_key
from ..repositories import AuditLogRepository
from ..repositories.document_repo import DocumentRepository as DocumentRepo


@router.post("/create")
@limiter.limit("10/minute")
async def create_document(
    request: Request, doc: DocumentModel, user: dict = Depends(require_auth)
) -> dict:
    payload = sanitize_document_model(doc.model_dump())
    title = payload.get("meta", {}).get("title", "Untitled Document")

    # Ensure profile row exists for schemas that enforce documents.user_id -> profiles.id.
    # Handles both newer (email/full_name) and legacy (display_name) profile schemas.
    ensure_profile_row(user)

    new_doc = DocumentRepository.create(title, payload, user_id=user["sub"])

    AuditLogRepository.create(
        user_id=user["sub"],
        resource_id=new_doc["id"],
        resource_type="document",
        action="created",
        ip_address=request.client.host if request.client else "unknown",
    )

    return {"id": new_doc["id"], "status": "created"}


@router.get("/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(require_auth)) -> dict:
    doc = check_ownership(doc_id, user)
    model = doc.get("document_model", {})
    if isinstance(model, dict):
        model = normalize_model(model)
    return {
        "id": doc_id,
        "document_model": model,
        "workspace_id": str(doc.get("workspace_id"))
        if doc.get("workspace_id")
        else None,
    }


@router.get("/{doc_id}/preview")
async def get_document_preview(doc_id: str, user: dict = Depends(require_auth)) -> dict:
    check_ownership(doc_id, user)
    object_name = f"documents/{doc_id}.pdf"
    if not r2_storage.object_exists(object_name):
        raise HTTPException(status_code=404, detail="PDF preview is not available yet")
    url = r2_storage.generate_presigned_url(object_name)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate preview URL")
    return {"id": doc_id, "preview_url": url, "status": "ready"}


@router.get("/{doc_id}/page/{page_index}/image")
async def get_page_image(
    doc_id: str, page_index: int, user: dict = Depends(require_auth)
) -> dict:
    """Render a single PDF page to PNG and return a presigned URL.

    Images are cached in R2 at page-images/{doc_id}/{page_index}.png so
    repeat requests are fast (presigned URL only, no re-render).
    """
    import fitz  # PyMuPDF

    check_ownership(doc_id, user)

    if page_index < 0:
        raise HTTPException(status_code=400, detail="page_index must be >= 0")

    cache_key = f"page-images/{doc_id}/{page_index}.png"

    # Return cached render if it already exists.
    if r2_storage.object_exists(cache_key):
        url = r2_storage.generate_presigned_url(cache_key, expiration=3600 * 6)
        if url:
            return {"url": url, "page_index": page_index, "cached": True}

    # Download the original PDF from R2.
    pdf_bytes = r2_storage.download_bytes(f"documents/{doc_id}.pdf")
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Original PDF not found in storage")

    # Render at 2× scale (150 dpi native → ~300 dpi output).
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if page_index >= len(doc):
            raise HTTPException(
                status_code=404, detail=f"Page {page_index} does not exist"
            )
        page = doc[page_index]
        mat = fitz.Matrix(2.0, 2.0)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        png_bytes = pix.tobytes("png")
        doc.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Page render failed: {exc}"
        ) from exc

    # Cache the PNG in R2.
    r2_storage.upload_bytes(png_bytes, cache_key)
    url = r2_storage.generate_presigned_url(cache_key, expiration=3600 * 6)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to upload page image")

    return {"url": url, "page_index": page_index, "cached": False}


@router.post("/{doc_id}/assets")
async def upload_asset(
    doc_id: str, file: UploadFile = File(...), user: dict = Depends(require_auth)
) -> dict:
    """Upload an asset (image/shape) for a document to R2."""
    check_ownership(doc_id, user)

    # Generate unique asset key: assets/{doc_id}/{uuid}.{ext}
    import os
    import uuid

    ext = os.path.splitext(file.filename)[1] if file.filename else ".png"
    asset_id = str(uuid.uuid4())
    cache_key = f"assets/{doc_id}/{asset_id}{ext}"

    file_bytes = await file.read()
    r2_storage.upload_bytes(file_bytes, cache_key)
    url = r2_storage.generate_presigned_url(
        cache_key, expiration=3600 * 24 * 365
    )  # 1 year

    if not url:
        raise HTTPException(status_code=500, detail="Failed to upload asset")

    return {"asset_id": asset_id, "url": url}


@router.put("/{doc_id}")
async def update_document(
    doc_id: str, doc: DocumentModel, user: dict = Depends(require_auth)
) -> dict:

    check_ownership(doc_id, user)

    sanitized = sanitize_document_model(doc.model_dump())
    DocumentRepository.update(
        doc_id, {"title": doc.meta.title, "document_model": sanitized}
    )
    return {"id": doc_id, "status": "success"}


async def _export_via_go(doc_dict: dict, format_type: str) -> bytes | None:
    """Try Go export service first. Returns None if unavailable or fails."""
    if not EXPORT_SERVICE_URL:
        return None
    try:
        import httpx

        headers = {
            "Content-Type": "application/json",
            "X-Worker-Secret": WORKER_SECRET,
        }
        payload = {
            "document_model": doc_dict,
            "color_space": doc_dict.get("meta", {}).get("color_space", "rgb"),
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{EXPORT_SERVICE_URL}/export/{format_type}",
                headers=headers,
                json=payload,
            )
        if resp.status_code != 200:
            return None
        return resp.content
    except Exception:
        return None


@router.post("/{doc_id}/export/{format_type}")
@limiter.limit("5/minute")
async def export_document(
    request: Request,
    doc_id: str,
    format_type: str,
    export_req: ExportRequest,
    user: dict = Depends(require_auth),
) -> dict:
    check_ownership(doc_id, user)
    try:
        format_alias = {
            "pdf": "standard",
            "pdfa": "pdf_a",
            "text": "txt",
        }
        normalized_format = format_alias.get(format_type, format_type)
        doc = export_req.document_model
        font_metrics = export_req.font_metrics or {}
        doc_dict = doc.model_dump()

        # Try Go export service first
        go_bytes = await _export_via_go(doc_dict, normalized_format)
        if go_bytes:
            object_name = f"exports/{doc_id}.{normalized_format}"
            url = r2_storage.upload_bytes_and_presign(go_bytes, object_name)
            if not url:
                raise HTTPException(status_code=500, detail="Failed to upload export")
            return {
                "id": doc_id,
                "url": url,
                "size": len(go_bytes),
                "format": normalized_format,
                "engine": "go",
            }

        # Fallback to Python export
        if normalized_format == "fidelity" or doc.meta.layout_mode == "fidelity":
            from ..reflow_engine import reflow_document

            doc_dict = reflow_document(doc_dict)

        engine = ExportEngineFactory.get_engine(normalized_format)

        if normalized_format == "fidelity":
            color_space = (
                doc.meta.color_space if hasattr(doc.meta, "color_space") else "rgb"
            )
            pdf_bytes = engine(
                doc_dict, color_space=color_space, font_metrics=font_metrics
            )
        else:
            pdf_bytes = engine(doc_dict)

        object_name = f"exports/{doc_id}.{normalized_format}"
        url = r2_storage.upload_bytes_and_presign(pdf_bytes, object_name)
        if not url:
            raise HTTPException(status_code=500, detail="Failed to upload export")

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

        return {
            "id": doc_id,
            "url": url,
            "size": len(pdf_bytes),
            "format": normalized_format,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{doc_id}/preflight")
async def document_preflight(
    doc_id: str, doc: DocumentModel, user: dict = Depends(require_auth)
) -> List[dict]:
    check_ownership(doc_id, user)
    return run_preflight(doc.model_dump())


@router.post("/{document_id}/snapshot")
@router.get("/export/stream/{job_id}")
async def stream_export_status(job_id: str):
    """SSE endpoint — Redis pub/sub replaces polling for async exports."""
    import json

    from fastapi.responses import StreamingResponse

    async def event_generator():
        done = await cache_get(export_status_key(job_id))
        if done:
            yield f"data: {json.dumps(done)}\n\n"
            return
        from ..core.cache import get_redis

        r = await get_redis()
        if r:
            async with r.pubsub() as pubsub:
                await pubsub.subscribe(f"olpdf:export_done:{job_id}")
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        yield f"data: {message['data']}\n\n"
                        break
        yield f"data: {json.dumps({'status': 'timeout'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/{document_id}/snapshot")
async def create_document_snapshot(
    document_id: str,
    payload: DocumentSnapshotPayload,
    user: dict = Depends(require_auth),
) -> dict:
    check_ownership(document_id, user)
    DocumentRepository.create_log(
        document_id,
        f"Snapshot: {payload.version_name or 'Auto'}",
        [],
        {"after": payload.document_model.blocks},
        "version_snapshot",
    )
    return {"status": "success"}


@router.get("/{document_id}/versions", response_model=List[VersionHistoryEntry])
async def get_document_versions(
    document_id: str, user: dict = Depends(require_auth)
) -> List[VersionHistoryEntry]:
    check_ownership(document_id, user)
    logs = DocumentRepository.get_logs(document_id)
    return [l for l in logs if l["status"] == "version_snapshot"]
