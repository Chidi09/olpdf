from typing import List
from fastapi import APIRouter, Depends
from ..repositories import ApiKeyRepository
from ..auth_utils import require_auth
from ..models import ApiKeyCreatePayload
from ..repositories import AuditLogRepository
from ..security_utils import generate_api_key, hash_api_key, get_key_prefix

router = APIRouter(prefix="/api/keys", tags=["api-keys"])

@router.post("")
async def create_api_key(payload: ApiKeyCreatePayload, user: dict = Depends(require_auth)) -> dict:
    """Generates a new API key for the user."""
    raw_key = generate_api_key()
    key_hash = hash_api_key(raw_key)
    prefix = get_key_prefix(raw_key)
    
    key = ApiKeyRepository.create(
        user_id=user["sub"],
        name=payload.name,
        key_hash=key_hash,
        prefix=prefix,
        scopes=payload.scopes,
        expires_at=payload.expires_at,
    )

    AuditLogRepository.create(
        user_id=user["sub"],
        resource_id=str(key["id"]),
        resource_type="api_key",
        action="created",
        metadata={"name": payload.name, "scopes": payload.scopes},
    )
    
    return {
        "key": raw_key,
        "api_key": {
            "id": key["id"],
            "name": payload.name,
            "prefix": prefix,
            "scopes": payload.scopes,
            "is_active": key.get("is_active", True),
            "expires_at": payload.expires_at,
            "last_used_at": key.get("last_used_at"),
            "created_at": key.get("created_at"),
        },
        "prefix": prefix,
        "name": payload.name,
        "scopes": payload.scopes,
        "expires_at": payload.expires_at,
        "message": "Copy this key now. It will not be shown again."
    }

@router.get("")
async def list_api_keys(user: dict = Depends(require_auth)) -> List[dict]:
    """Lists metadata for all API keys owned by the user."""
    keys = ApiKeyRepository.list_for_user(user["sub"])
    # Don't return the hash!
    return [
        {
            "id": k["id"],
            "name": k["name"],
            "prefix": k["prefix"],
            "scopes": k.get("scopes", []),
            "is_active": k.get("is_active", True),
            "expires_at": k.get("expires_at"),
            "last_used_at": k["last_used_at"],
            "created_at": k["created_at"]
        }
        for k in keys
    ]

@router.delete("/{key_id}")
async def delete_api_key(key_id: str, user: dict = Depends(require_auth)) -> dict:
    """Revokes an API key."""
    ApiKeyRepository.delete(key_id, user["sub"])
    AuditLogRepository.create(
        user_id=user["sub"],
        resource_id=key_id,
        resource_type="api_key",
        action="revoked",
    )
    return {"status": "success", "message": "API key revoked"}
