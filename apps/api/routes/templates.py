from typing import List
from fastapi import APIRouter, Depends, HTTPException
from ..repositories import TemplateRepository, DocumentRepository
from ..auth_utils import require_auth

router = APIRouter(prefix="/api/templates", tags=["templates"])

@router.get("")
async def list_templates(user: dict = Depends(require_auth)) -> List[dict]:
    return TemplateRepository.list_all()

@router.post("/{template_id}/apply")
async def apply_template(template_id: str, document_id: str, user: dict = Depends(require_auth)) -> dict:
    template = TemplateRepository.get_by_id(template_id)
    if not template: raise HTTPException(status_code=404, detail="Template not found")
    
    doc = DocumentRepository.get_by_id(document_id)
    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("user_id") and str(doc["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")
        
    # Apply template logic (e.g. merge styles)
    model = doc["document_model"]
    model["styles"] = template["document_model"].get("styles", {})
    DocumentRepository.update(document_id, {"document_model": model})
    
    return {"status": "success", "template_id": template_id}
