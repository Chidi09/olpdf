from typing import Any, Dict, List, Optional
from ..core.supabase_client import supabase


class TenantRepository:
    @staticmethod
    def get_by_id(tenant_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("tenants").select("*").eq("id", tenant_id).single().execute()
        return res.data

    @staticmethod
    def get_by_slug(slug: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("tenants").select("*").eq("slug", slug).single().execute()
        return res.data

    @staticmethod
    def get_by_domain(domain: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("tenants").select("*").eq("custom_domain", domain).single().execute()
        return res.data

    @staticmethod
    def list_for_user(user_id: str) -> List[Dict[str, Any]]:
        return (
            supabase.table("tenants")
            .select("*, tenant_members!inner(role)")
            .eq("tenant_members.user_id", user_id)
            .execute()
            .data or []
        )

    @staticmethod
    def create(owner_id: str, slug: str, name: str, plan: str = "starter") -> Dict[str, Any]:
        tenant = supabase.table("tenants").insert({
            "owner_id": owner_id,
            "slug": slug,
            "name": name,
            "plan": plan,
        }).execute().data[0]
        # Auto-enroll owner as member
        supabase.table("tenant_members").insert({
            "tenant_id": tenant["id"],
            "user_id": owner_id,
            "role": "owner",
        }).execute()
        return tenant

    @staticmethod
    def update_branding(tenant_id: str, branding: Dict[str, Any]) -> Dict[str, Any]:
        allowed = {"name", "logo_url", "primary_color", "accent_color", "favicon_url", "custom_domain"}
        patch = {k: v for k, v in branding.items() if k in allowed}
        return supabase.table("tenants").update(patch).eq("id", tenant_id).execute().data[0]

    @staticmethod
    def update_features(tenant_id: str, features: Dict[str, Any]) -> Dict[str, Any]:
        return supabase.table("tenants").update({"features": features}).eq("id", tenant_id).execute().data[0]

    @staticmethod
    def set_plan(tenant_id: str, plan: str) -> None:
        supabase.table("tenants").update({"plan": plan}).eq("id", tenant_id).execute()

    @staticmethod
    def deactivate(tenant_id: str) -> None:
        supabase.table("tenants").update({"is_active": False}).eq("id", tenant_id).execute()

    @staticmethod
    def list_members(tenant_id: str) -> List[Dict[str, Any]]:
        return (
            supabase.table("tenant_members")
            .select("*, profiles(id, email, full_name)")
            .eq("tenant_id", tenant_id)
            .execute()
            .data or []
        )

    @staticmethod
    def add_member(tenant_id: str, user_id: str, role: str = "member") -> None:
        supabase.table("tenant_members").upsert({
            "tenant_id": tenant_id,
            "user_id": user_id,
            "role": role,
        }).execute()

    @staticmethod
    def remove_member(tenant_id: str, user_id: str) -> None:
        supabase.table("tenant_members").delete().eq("tenant_id", tenant_id).eq("user_id", user_id).execute()

    @staticmethod
    def get_member_role(tenant_id: str, user_id: str) -> Optional[str]:
        res = (
            supabase.table("tenant_members")
            .select("role")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        return res.data["role"] if res.data else None
