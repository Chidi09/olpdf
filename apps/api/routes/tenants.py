from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List

from ..core.auth import get_current_user
from ..models import TenantResponse, TenantBrandingPayload, TenantCreatePayload, TenantMemberAddPayload
from ..services import tenant_service

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/me", response_model=List[TenantResponse])
async def list_my_tenants(current_user: dict = Depends(get_current_user)):
    """List all tenants where the current user is a member."""
    from ..repositories.tenant_repo import TenantRepository
    return TenantRepository.list_for_user(current_user["user_id"])


@router.post("/", response_model=TenantResponse)
async def create_tenant(
    payload: TenantCreatePayload,
    current_user: dict = Depends(get_current_user)
):
    """Create a new white-label tenant."""
    return tenant_service.create_tenant(
        owner_id=current_user["user_id"],
        slug=payload.slug,
        name=payload.name
    )


@router.get("/resolve", response_model=TenantResponse)
async def resolve_tenant(request: Request):
    """Resolve a tenant by its custom domain or slug from header."""
    hostname = request.headers.get("host", "")
    # Try custom domain first
    try:
        return tenant_service.resolve_tenant(domain=hostname)
    except HTTPException:
        # Fallback to slug from header if provided (e.g. X-Tenant-Slug)
        slug = request.headers.get("X-Tenant-Slug")
        if slug:
            return tenant_service.resolve_tenant(slug=slug)
        raise HTTPException(status_code=404, detail="Tenant could not be resolved from host or headers")


@router.patch("/{tenant_id}/branding", response_model=TenantResponse)
async def update_tenant_branding(
    tenant_id: str,
    payload: TenantBrandingPayload,
    current_user: dict = Depends(get_current_user)
):
    """Update tenant branding and custom domain (requires correct plan)."""
    return tenant_service.update_branding(
        tenant_id=tenant_id,
        user_id=current_user["user_id"],
        branding=payload.model_dump(exclude_unset=True)
    )


@router.post("/{tenant_id}/members")
async def add_tenant_member(
    tenant_id: str,
    payload: TenantMemberAddPayload,
    current_user: dict = Depends(get_current_user)
):
    """Add a member to the tenant (requires admin/owner)."""
    tenant_service.add_member(
        tenant_id=tenant_id,
        requester_id=current_user["user_id"],
        user_id=payload.user_id,
        role=payload.role
    )
    return {"message": "Member added"}
