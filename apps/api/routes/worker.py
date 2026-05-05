import base64
import hashlib
import hmac
import os
from fastapi import APIRouter, HTTPException, Request
from ..models import WorkerImportPayload
from ..worker_utils import route_pdf_import
from ..cleanup_utils import cleanup_old_exports

router = APIRouter(prefix="/api/worker", tags=["worker"])

def _verify_qstash_signature(raw_body: bytes, signature: str | None) -> bool:
    signing_key = os.environ.get("QSTASH_CURRENT_SIGNING_KEY", "")
    next_signing_key = os.environ.get("QSTASH_NEXT_SIGNING_KEY", "")
    if not signing_key and not next_signing_key:
        if os.environ.get("OLPDF_DEV_MODE") == "true":
            return True
        return False
    if not signature: return False
    
    for key in (signing_key, next_signing_key):
        if not key:
            continue
        digest = hmac.new(key.encode("utf-8"), raw_body, hashlib.sha256).digest()
        expected = base64.b64encode(digest).decode("utf-8")
        if hmac.compare_digest(expected, signature):
            return True

    return False

def _require_qstash(request: Request, raw_body: bytes) -> None:
    signature = request.headers.get("Upstash-Signature")
    if not _verify_qstash_signature(raw_body, signature):
        raise HTTPException(status_code=401, detail="Invalid QStash signature")

@router.post("/cleanup-exports")
async def worker_cleanup_exports(request: Request) -> dict:
    raw_body = await request.body()
    _require_qstash(request, raw_body)
    return cleanup_old_exports()

@router.post("/process-import")
async def worker_process_import(request: Request) -> dict:
    raw_body = await request.body()
    _require_qstash(request, raw_body)
    payload = WorkerImportPayload.model_validate_json(raw_body)
    result = await route_pdf_import(payload.file_bytes, payload.document_id)
    return {"status": "processed", "document_id": payload.document_id, **result}
