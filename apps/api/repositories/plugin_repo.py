from typing import Any, Dict, List, Optional
from ..core.supabase_client import supabase


class PluginRepository:
    @staticmethod
    def list_published(category: Optional[str] = None) -> List[Dict[str, Any]]:
        q = supabase.table("plugins").select("*").eq("is_published", True)
        if category:
            q = q.eq("category", category)
        return q.order("installs", desc=True).execute().data or []

    @staticmethod
    def get_by_id(plugin_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("plugins").select("*").eq("id", plugin_id).single().execute()
        return res.data

    @staticmethod
    def get_by_slug(slug: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("plugins").select("*").eq("slug", slug).single().execute()
        return res.data

    @staticmethod
    def create(author_id: str, name: str, slug: str, description: str, manifest: Dict, bundle_url: str, version: str, category: str) -> Dict[str, Any]:
        return supabase.table("plugins").insert({
            "author_id": author_id,
            "name": name,
            "slug": slug,
            "description": description,
            "manifest": manifest,
            "bundle_url": bundle_url,
            "version": version,
            "category": category,
            "is_published": False,
            "is_verified": False,
            "installs": 0,
        }).execute().data[0]

    @staticmethod
    def publish(plugin_id: str) -> None:
        supabase.table("plugins").update({"is_published": True}).eq("id", plugin_id).execute()

    @staticmethod
    def verify(plugin_id: str) -> None:
        supabase.table("plugins").update({"is_verified": True}).eq("id", plugin_id).execute()

    @staticmethod
    def increment_installs(plugin_id: str) -> None:
        supabase.rpc("increment_plugin_installs", {"plugin_id": plugin_id}).execute()

    @staticmethod
    def install_for_workspace(workspace_id: str, plugin_id: str, installed_by: str) -> None:
        supabase.table("workspace_plugins").upsert({"workspace_id": workspace_id, "plugin_id": plugin_id, "installed_by": installed_by}).execute()
        PluginRepository.increment_installs(plugin_id)

    @staticmethod
    def uninstall_for_workspace(workspace_id: str, plugin_id: str) -> None:
        supabase.table("workspace_plugins").delete().eq("workspace_id", workspace_id).eq("plugin_id", plugin_id).execute()

    @staticmethod
    def list_installed(workspace_id: str) -> List[Dict[str, Any]]:
        return supabase.table("workspace_plugins").select("*, plugins(*)").eq("workspace_id", workspace_id).execute().data or []
