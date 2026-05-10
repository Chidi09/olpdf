import secrets
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from ..auth_utils import require_auth, require_role
from ..repositories import WorkspaceRepository, DocumentRepository, BookRepository, PluginRepository
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

@router.get("/{workspace_id}/plugins")
async def list_workspace_plugins(workspace_id: str, role: str = Depends(require_role(["owner", "admin", "editor", "viewer", "commenter"]))) -> List[Dict[str, Any]]:
    installed = PluginRepository.list_installed(workspace_id)
    # Flatten the plugins(*) structure for easier frontend usage
    return [
        {**i["plugins"], "installed_at": i["installed_at"], "installed_by": i["installed_by"]}
        for i in installed if i.get("plugins")
    ]

@router.post("/{workspace_id}/plugins/{plugin_id}")
async def install_plugin(workspace_id: str, plugin_id: str, user: dict = Depends(require_auth), role: str = Depends(require_role(["owner", "admin"]))) -> Dict[str, Any]:
    plugin = PluginRepository.get_by_id(plugin_id)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
        
    locked_version = plugin.get("version")
    PluginRepository.install_for_workspace(workspace_id, plugin_id, user["sub"], locked_version)
    return {"status": "success", "locked_version": locked_version}

@router.delete("/{workspace_id}/plugins/{plugin_id}")
async def uninstall_plugin(workspace_id: str, plugin_id: str, role: str = Depends(require_role(["owner", "admin"]))) -> Dict[str, Any]:
    PluginRepository.uninstall_for_workspace(workspace_id, plugin_id)
    return {"status": "success"}
