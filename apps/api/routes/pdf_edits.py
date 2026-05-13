from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from ..auth_utils import require_auth, check_ownership
from ..repositories import DocumentRepository

router = APIRouter(prefix="/api/documents", tags=["pdf-edits"])


@router.get("/{doc_id}/operations")
async def get_operations(doc_id: str, user: dict = Depends(require_auth)) -> dict:
    doc = check_ownership(doc_id, user)
    model = doc.get("document_model") or {}
    operations = model.get("operations") or []
    return {"operations": operations}


@router.put("/{doc_id}/operations")
async def put_operations(doc_id: str, body: Dict[str, Any], user: dict = Depends(require_auth)) -> dict:
    check_ownership(doc_id, user)
    new_operations: List[Dict[str, Any]] = body.get("operations", [])
    doc = DocumentRepository.find_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    model = doc.get("document_model") or {}
    model["operations"] = new_operations
    DocumentRepository.update(doc_id, {"document_model": model})
    return {"status": "ok", "count": len(new_operations)}
