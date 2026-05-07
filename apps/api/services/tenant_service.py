import re
from typing import Any, Dict, Optional

from fastapi import HTTPException

from ..repositories.tenant_repo import TenantRepository

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

PLAN_FEATURE_LIMITS = {
    "starter":    {"max_members": 5,  "custom_domain": False, "white_label": False},
    "pro":        {"max_members": 25, "custom_domain": True,  "white_label": False},
    "enterprise": {"max_members": -1, "custom_domain": True,  "white_label": True},
}


def _validate_slug(slug: str) -> None:
    if not _SLUG_RE.match(slug):
        raise HTTPException(status_code=422, detail="Slug must be lowercase alphanumeric with hyphens only")


def create_tenant(owner_id: str, slug: str, name: str) -> Dict[str, Any]:
    _validate_slug(slug)
    if TenantRepository.get_by_slug(slug):
        raise HTTPException(status_code=409, detail=f"Tenant slug '{slug}' is already taken")
    return TenantRepository.create(owner_id=owner_id, slug=slug, name=name)


def get_tenant_config(tenant_id: str) -> Dict[str, Any]:
    tenant = TenantRepository.get_by_id(tenant_id)
    if not tenant or not tenant.get("is_active"):
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def resolve_tenant(*, slug: Optional[str] = None, domain: Optional[str] = None) -> Dict[str, Any]:
    if domain:
        tenant = TenantRepository.get_by_domain(domain)
    elif slug:
        tenant = TenantRepository.get_by_slug(slug)
    else:
        raise HTTPException(status_code=400, detail="Provide slug or domain")
    if not tenant or not tenant.get("is_active"):
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def update_branding(tenant_id: str, user_id: str, branding: Dict[str, Any]) -> Dict[str, Any]:
    _assert_owner_or_admin(tenant_id, user_id)
    tenant = TenantRepository.get_by_id(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    plan = tenant.get("plan", "starter")
    if branding.get("custom_domain") and not PLAN_FEATURE_LIMITS[plan]["custom_domain"]:
        raise HTTPException(status_code=403, detail="Custom domains require Pro plan or higher")
    return TenantRepository.update_branding(tenant_id, branding)


def add_member(tenant_id: str, requester_id: str, user_id: str, role: str = "member") -> None:
    _assert_owner_or_admin(tenant_id, requester_id)
    tenant = TenantRepository.get_by_id(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    plan = tenant.get("plan", "starter")
    limit = PLAN_FEATURE_LIMITS[plan]["max_members"]
    if limit != -1:
        current = len(TenantRepository.list_members(tenant_id))
        if current >= limit:
            raise HTTPException(status_code=403, detail=f"Member limit ({limit}) reached for {plan} plan")
    TenantRepository.add_member(tenant_id, user_id, role)


def remove_member(tenant_id: str, requester_id: str, user_id: str) -> None:
    _assert_owner_or_admin(tenant_id, requester_id)
    TenantRepository.remove_member(tenant_id, user_id)


def _assert_owner_or_admin(tenant_id: str, user_id: str) -> None:
    role = TenantRepository.get_member_role(tenant_id, user_id)
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient tenant permissions")
