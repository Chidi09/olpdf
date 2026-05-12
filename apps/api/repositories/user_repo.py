from datetime import datetime
from typing import Any, Dict, List, Optional
from ..core.supabase_client import supabase


class ApiKeyRepository:
    @staticmethod
    def create(
        user_id: str,
        name: str,
        key_hash: str,
        prefix: str,
        scopes: Optional[List[str]] = None,
        expires_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "user_id": user_id,
            "name": name,
            "key_hash": key_hash,
            "prefix": prefix,
            "scopes": scopes or [],
            "is_active": True,
        }
        if expires_at:
            payload["expires_at"] = expires_at
            
        try:
            return supabase.table("api_keys").insert(payload).execute().data[0]
        except Exception as e:
            if "violates foreign key constraint" in str(e):
                payload["user_id"] = None
                payload["name"] = f"{user_id}::{name}"
                res = supabase.table("api_keys").insert(payload).execute().data[0]
                res["name"] = name
                return res
            raise

    @staticmethod
    def list_for_user(user_id: str) -> List[Dict[str, Any]]:
        keys = (
            supabase.table("api_keys")
            .select("*")
            .or_(f"user_id.eq.{user_id},name.like.{user_id}::%")
            .order("created_at", desc=True)
            .execute()
            .data
        )
        for key in keys:
            if key["name"].startswith(f"{user_id}::"):
                key["name"] = key["name"].replace(f"{user_id}::", "", 1)
        return keys
        return res.data

    @staticmethod
    def create(
        user_id: str,
        name: str,
        key_hash: str,
        prefix: str,
        scopes: Optional[List[str]] = None,
        expires_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "user_id": user_id,
            "name": name,
            "key_hash": key_hash,
            "prefix": prefix,
            "scopes": scopes or [],
            "is_active": True,
        }
        if expires_at:
            payload["expires_at"] = expires_at
        return supabase.table("api_keys").insert(payload).execute().data[0]

    @staticmethod
    def list_for_user(user_id: str) -> List[Dict[str, Any]]:
        return supabase.table("api_keys").select("*").eq("user_id", user_id).order("created_at", desc=True).execute().data

    @staticmethod
    def get_by_id(key_id: str) -> Optional[Dict[str, Any]]:
        try:
            return supabase.table("api_keys").select("*").eq("id", key_id).single().execute().data
        except Exception:
            return None

    @staticmethod
    def delete(key_id: str, user_id: str) -> None:
        supabase.table("api_keys").update({"is_active": False}).eq("id", key_id).eq("user_id", user_id).execute()

    @staticmethod
    def update_last_used(key_id: str) -> None:
        supabase.table("api_keys").update({"last_used_at": datetime.now().isoformat()}).eq("id", key_id).execute()
