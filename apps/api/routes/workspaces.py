import secrets
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from ..auth_utils import require_auth, require_role
from ..repositories import WorkspaceRepository, DocumentRepository, BookRepository
from ..models import WorkspaceCreatePayload, WorkspaceUpdatePayload

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

@router.get("")
async def list_user_workspaces(user: dict = Depends(require_auth)) -> List[Dict[str, Any]]:
    # In a real implementation, WorkspaceRepository would have a list_for_user method
    from ..supabase_client import supabase
    res = supabase.table("workspace_users").select("workspace_id, role, workspaces(*)").eq("user_id", user["sub"]).execute()
    return [{"id": m["workspace_id"], "role": m["role"], **m["workspaces"]} for m in res.data]

@router.post("")
async def create_workspace(payload: WorkspaceCreatePayload, user: dict = Depends(require_auth)) -> Dict[str, Any]:
    slug = payload.name.lower().replace(" ", "-") + "-" + secrets.token_hex(4)
    workspace = WorkspaceRepository.create(payload.name, slug, user["sub"])
    return workspace

@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str, role: str = Depends(require_role(["owner", "admin", "editor", "viewer"]))) -> Dict[str, Any]:
    workspace = WorkspaceRepository.get_by_id(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace

@router.get("/{workspace_id}/members")
async def list_workspace_members(workspace_id: str, role: str = Depends(require_role(["owner", "admin"]))) -> List[Dict[str, Any]]:
    from ..supabase_client import supabase
    res = supabase.table("workspace_users").select("user_id, role, profiles(display_name)").eq("workspace_id", workspace_id).execute()
    return res.data

@router.post("/{workspace_id}/members")
async def add_workspace_member(workspace_id: str, user_id: str, role: str, current_role: str = Depends(require_role(["owner", "admin"]))) -> dict:
    # Role checking: admins can't add owners
    if current_role == "admin" and role == "owner":
        raise HTTPException(status_code=403, detail="Admins cannot add owners")
        
    WorkspaceRepository.add_user(workspace_id, user_id, role)
    return {"status": "success"}

@router.get("/{workspace_id}/documents")
async def list_workspace_documents(workspace_id: str, role: str = Depends(require_role(["owner", "admin", "editor", "viewer"]))) -> List[Dict[str, Any]]:
    from ..supabase_client import supabase
    res = supabase.table("documents").select("id, title, status, created_at").eq("workspace_id", workspace_id).execute()
    return res.data
