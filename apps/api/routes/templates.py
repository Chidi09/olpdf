from fastapi import APIRouter, Depends, HTTPException
from typing import List
from ..core.supabase_client import get_supabase
from ..core.auth import get_current_user
from ..models import TemplateResponse
from ..models.requests import PublishTemplatePayload

router = APIRouter(prefix="/templates", tags=["templates"])

@router.get("/", response_model=List[TemplateResponse])
async def list_templates(category: str = None):
    supabase = get_supabase()
    query = supabase.table("templates").select("*").eq("is_public", True)
    if category:
        query = query.eq("category", category)
    response = query.execute()
    return response.data

@router.post("/publish")
async def publish_template(
    payload: PublishTemplatePayload,
    current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    
    # Verify document ownership and get model
    doc = supabase.table("documents").select("document_model").eq("id", payload.document_id).eq("user_id", current_user["user_id"]).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found or access denied")
        
    # Create template
    new_template = supabase.table("templates").insert({
        "title": payload.title,
        "category": payload.category,
        "description": payload.description,
        "document_model": doc.data["document_model"],
        "author_id": current_user["user_id"],
        "author_name": current_user.get("user_metadata", {}).get("full_name", "Community Contributor"),
        "is_public": True,
        "uses_count": 0
    }).execute()
    
    if not new_template.data:
        raise HTTPException(status_code=500, detail="Failed to publish template")
        
    return {"status": "success", "template_id": new_template.data[0]["id"]}

@router.post("/{template_id}/apply")
async def apply_template(
    template_id: str,
    workspace_id: str,
    current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    
    # Get template
    template = supabase.table("templates").select("*").eq("id", template_id).single().execute()
    if not template.data:
        raise HTTPException(status_code=404, detail="Template not found")
        
    # Create document directly from template's document_model
    new_doc = supabase.table("documents").insert({
        "workspace_id": workspace_id,
        "user_id": current_user["user_id"],
        "document_model": template.data["document_model"],
        "title": f"New from {template.data['title']}"
    }).execute()
    
    if not new_doc.data:
        raise HTTPException(status_code=500, detail="Failed to create document from template")

    # Increment uses count
    supabase.table("templates").update({
        "uses_count": template.data.get("uses_count", 0) + 1
    }).eq("id", template_id).execute()
    
    return {"document_id": new_doc.data[0]["id"]}
