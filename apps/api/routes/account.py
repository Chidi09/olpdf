import io
import json
import zipfile
from typing import Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from ..repositories import DocumentRepository, BookRepository, ApiKeyRepository
from ..auth_utils import require_auth
from ..supabase_client import supabase_admin, supabase

router = APIRouter(prefix="/api/account", tags=["account"])

@router.delete("/delete")
async def delete_account(user: dict = Depends(require_auth)) -> dict:
    """
    Delete the user's account and all associated data.
    Requires supabase_admin for user deletion from the auth schema.
    """
    user_id = user["sub"]
    try:
        # Cascading deletion of data using service role
        # Note: The database migrations should ideally handle cascading deletes 
        # from profiles -> documents, books, etc.
        # But we do explicit cleanup of Supabase Auth here.
        res = supabase_admin.auth.admin.delete_user(user_id)
        return {"status": "success", "message": "Account scheduled for deletion"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export-data")
async def export_data(user: dict = Depends(require_auth)):
    """
    Export all user data as a machine-readable ZIP archive (JSON format).
    """
    user_id = user["sub"]
    
    try:
        # Fetch data
        documents_res = supabase.table("documents").select("*").eq("user_id", user_id).execute()
        books_res = supabase.table("books").select("*").eq("user_id", user_id).execute()
        api_keys_res = supabase.table("api_keys").select("id, name, prefix, created_at, last_used_at").eq("user_id", user_id).execute()
        
        # Create ZIP in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.writestr("documents.json", json.dumps(documents_res.data, indent=2))
            zip_file.writestr("books.json", json.dumps(books_res.data, indent=2))
            zip_file.writestr("api_keys.json", json.dumps(api_keys_res.data, indent=2))
            zip_file.writestr("metadata.json", json.dumps({
                "export_date": "2026-05-06",
                "user_id": user_id,
                "version": "1.0"
            }, indent=2))
            
        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=olpdf-data-export-{user_id}.zip"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
