import logging
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import HTTPException, Depends, Request, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from jose import jwt, JWTError

from .security import hash_api_key

logger = logging.getLogger("olpdf-api")

security = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_jwt_token(token: str) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")

    jwt_secret = os.environ.get("API_JWT_SECRET") or os.environ.get("SUPABASE_JWT_SECRET")
    if not jwt_secret:
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not configured")

    try:
        return jwt.decode(token, jwt_secret, algorithms=["HS256"], options={"verify_aud": False})
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(exc)}")


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    api_key: Optional[str] = Security(api_key_header),
) -> dict:
    from ..repositories.user_repo import ApiKeyRepository

    if credentials and credentials.credentials:
        try:
            payload = verify_jwt_token(credentials.credentials)
            payload["auth_type"] = "jwt"
            return payload
        except HTTPException as exc:
            if not api_key:
                raise exc

    if api_key:
        key_hash = hash_api_key(api_key)
        key_data = ApiKeyRepository.get_by_hash(key_hash)
        if not key_data:
            raise HTTPException(status_code=401, detail="Invalid API key")
        expires_at = key_data.get("expires_at")
        if expires_at:
            try:
                expiry = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
                if expiry <= datetime.now(timezone.utc):
                    raise HTTPException(status_code=401, detail="API key expired")
            except ValueError:
                raise HTTPException(status_code=401, detail="Invalid API key expiry")
        ApiKeyRepository.update_last_used(key_data["id"])
        return {
            "sub": str(key_data["user_id"]),
            "api_key_id": str(key_data["id"]),
            "auth_type": "api_key",
        }

    raise HTTPException(status_code=401, detail="Authentication required")


def require_auth(payload: dict = Depends(get_current_user)) -> dict:
    return payload


def require_scopes(required_scopes: List[str]):
    async def scope_checker(user: dict = Depends(require_auth)) -> None:
        if user.get("auth_type") != "api_key":
            return
        from ..repositories.user_repo import ApiKeyRepository

        key_id = str(user.get("api_key_id", ""))
        if not key_id:
            raise HTTPException(status_code=403, detail="API key scope validation failed")
        key = ApiKeyRepository.get_by_id(key_id)
        if not key or not key.get("is_active", True):
            raise HTTPException(status_code=403, detail="API key is inactive")
        expires_at = key.get("expires_at")
        if expires_at:
            try:
                expiry = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
                if expiry <= datetime.now(timezone.utc):
                    raise HTTPException(status_code=403, detail="API key has expired")
            except ValueError:
                raise HTTPException(status_code=403, detail="API key expiry is invalid")

        key_scopes = set(key.get("scopes") or [])
        if not set(required_scopes).issubset(key_scopes):
            raise HTTPException(status_code=403, detail="Insufficient API key scopes")

    return scope_checker


def check_ownership(
    resource_id: str,
    user: dict,
    resource_type: str = "document",
    required_role: Optional[str] = None,
) -> dict:
    from ..repositories.document_repo import DocumentRepository
    from ..repositories.book_repo import BookRepository
    from ..repositories.workspace_repo import WorkspaceRepository

    repo = DocumentRepository if resource_type == "document" else BookRepository
    resource = repo.get_by_id(resource_id)

    if not resource:
        raise HTTPException(status_code=404, detail=f"{resource_type.capitalize()} not found")

    if user.get("sub") == "dev-user":
        return resource

    owner_id = resource.get("user_id")
    if not owner_id and resource.get("document_model") and isinstance(resource.get("document_model"), dict):
        owner_id = resource["document_model"].get("owner_id")
    elif not owner_id and resource.get("meta") and isinstance(resource.get("meta"), dict):
        owner_id = resource["meta"].get("owner_id")

    if owner_id and str(owner_id) == user["sub"]:
        return resource

    workspace_id = resource.get("workspace_id")
    if workspace_id:
        membership = WorkspaceRepository.get_membership(str(workspace_id), user["sub"])
        if membership:
            if required_role:
                role_ranks = {"owner": 4, "admin": 3, "editor": 2, "viewer": 1, "commenter": 1}
                if role_ranks.get(membership["role"], 0) >= role_ranks.get(required_role, 0):
                    return resource
            else:
                return resource

    raise HTTPException(status_code=403, detail="Forbidden")


def require_role(allowed_roles: List[str]):
    async def role_checker(workspace_id: str, user: dict = Depends(require_auth)) -> str:
        from ..repositories.workspace_repo import WorkspaceRepository

        if user.get("sub") == "dev-user":
            return "owner"
        membership = WorkspaceRepository.get_membership(workspace_id, user["sub"])
        if not membership or membership["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return membership["role"]
    return role_checker


def ensure_profile_row(user: dict) -> None:
    """Idempotent: upsert a profile row for *user*.

    The profiles.id column may have a FK constraint referencing auth.users.
    If the user was created via the custom credential flow and does not exist
    in auth.users, this function tries to create the auth.users entry first,
    then retries the profile upsert.  If both fail, the error is logged but
    the caller **must not** crash — downstream tables (documents, api_keys,
    user_ai_settings, …) are expected to reference profiles.id via FK, and
    the call to **this** function is the best-effort attempt to satisfy that
    constraint.
    """
    from ..core.supabase_client import supabase, supabase_admin

    profile_id = user["sub"]
    email = user.get("email") or ""
    full_name = user.get("name") or ""

    def _try_upsert(payload: dict) -> bool:
        try:
            supabase.table("profiles").upsert(payload).execute()
            return True
        except Exception:
            return False

    # Fast path — most common: user already has a profile
    if _try_upsert({"id": profile_id, "email": email, "full_name": full_name}):
        return

    # The upsert above may have failed because profile_id is not in auth.users.
    # Try creating the auth.users entry, then retry.
    try:
        created = supabase_admin.auth.admin.create_user(
            {
                "email": email,
                "email_confirm": True,
                "user_metadata": {"full_name": full_name},
                "password": secrets.token_urlsafe(24),
            }
        )
        obj = getattr(created, "user", None) or (created.get("user") if isinstance(created, dict) else None)
        new_id = getattr(obj, "id", None) or (obj.get("id") if isinstance(obj, dict) else None)
        if new_id and str(new_id) != profile_id:
            # The admin API returned a different UUID than our session token.
            # Upsert with this new ID so FK constraints are satisfied.
            _try_upsert({"id": str(new_id), "email": email, "full_name": full_name})
            return
    except Exception as exc:
        logger.warning("admin.create_user in ensure_profile_row failed: %s", exc)

    # Last-resort fallback: try bare-minimum upsert
    _try_upsert({"id": profile_id, "full_name": full_name or email.split("@")[0]})
    _try_upsert({"id": profile_id})
