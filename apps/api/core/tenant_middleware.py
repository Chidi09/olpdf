"""
Resolve the active tenant from the request Host header or X-Tenant-Slug header
and attach it to request.state.tenant. Routes that need tenant context call
`get_tenant_from_request` as a FastAPI dependency.
"""
from typing import Optional

from fastapi import Depends, HTTPException, Request

from ..repositories.tenant_repo import TenantRepository


async def _resolve_tenant(request: Request) -> Optional[dict]:
    slug = request.headers.get("X-Tenant-Slug")
    if slug:
        return TenantRepository.get_by_slug(slug)

    host = request.headers.get("host", "").split(":")[0]
    # Ignore localhost / direct API access
    if host and "." in host and not host.endswith(".olpdf.xyz"):
        return TenantRepository.get_by_domain(host)

    return None


async def get_tenant_from_request(request: Request) -> Optional[dict]:
    tenant = await _resolve_tenant(request)
    if tenant and not tenant.get("is_active"):
        raise HTTPException(status_code=403, detail="Tenant is inactive")
    request.state.tenant = tenant
    return tenant


async def require_tenant(request: Request) -> dict:
    tenant = await get_tenant_from_request(request)
    if not tenant:
        raise HTTPException(status_code=400, detail="Tenant context required")
    return tenant
