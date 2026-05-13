from typing import Any, Dict, List, Optional
from ..core.supabase_client import supabase
from ..services.cache_service import cache_or_fetch, delete


class WorkspaceRepository:
    @staticmethod
    def get_by_id(workspace_id: str) -> Optional[Dict[str, Any]]:
        return cache_or_fetch(
            f"ws:{workspace_id}",
            lambda: _get_ws_by_id(workspace_id),
            ttl=600,
        )

    @staticmethod
    def get_membership(workspace_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        return cache_or_fetch(
            f"wsm:{workspace_id}:{user_id}",
            lambda: _get_membership_db(workspace_id, user_id),
            ttl=600,
        )

    @staticmethod
    def create(name: str, slug: str, owner_id: str) -> Dict[str, Any]:
        workspace = supabase.table("workspaces").insert({"name": name, "slug": slug, "owner_id": owner_id}).execute().data[0]
        supabase.table("workspace_users").insert({"workspace_id": workspace["id"], "user_id": owner_id, "role": "owner"}).execute()
        return workspace

    @staticmethod
    def add_user(workspace_id: str, user_id: str, role: str) -> None:
        supabase.table("workspace_users").insert({"workspace_id": workspace_id, "user_id": user_id, "role": role}).execute()
        delete(f"wsm:{workspace_id}:*")


def _get_ws_by_id(workspace_id: str) -> Optional[Dict[str, Any]]:
    res = supabase.table("workspaces").select("*").eq("id", workspace_id).single().execute()
    return res.data

def _get_membership_db(workspace_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    try:
        return supabase.table("workspace_users").select("*").eq("workspace_id", workspace_id).eq("user_id", user_id).single().execute().data
    except Exception:
        return None

    @staticmethod
    def list_members(workspace_id: str) -> List[Dict[str, Any]]:
        return supabase.table("workspace_users").select("*").eq("workspace_id", workspace_id).execute().data


class AuditLogRepository:
    @staticmethod
    def create(user_id: str, resource_id: str, resource_type: str, action: str, workspace_id: Optional[str] = None, metadata: Dict = {}, ip_address: Optional[str] = None) -> None:
        from ..core.supabase_client import supabase_admin
        payload: Dict[str, Any] = {"user_id": user_id, "resource_id": resource_id, "resource_type": resource_type, "action": action, "metadata": metadata, "ip_address": ip_address}
        if workspace_id:
            payload["workspace_id"] = workspace_id
        try:
            supabase_admin.table("audit_logs").insert(payload).execute()
        except Exception:
            # Bypass FK constraints for users without profiles
            payload["user_id"] = None
            try:
                supabase_admin.table("audit_logs").insert(payload).execute()
            except Exception:
                pass
