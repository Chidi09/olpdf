"""Pydantic response schemas."""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel


class ImportStatusPayload(BaseModel):
    document_id: str
    status: Literal["queued", "processing", "partial", "ready", "failed"]
    import_progress: int = 0
    pages_total: int = 0
    pages_native: int = 0
    pages_ocr: int = 0
    error: Optional[str] = None


class VersionHistoryEntry(BaseModel):
    id: UUID
    instruction: str
    status: str
    created_at: datetime
    version_name: Optional[str] = None


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded"]
    checks: Dict[str, str] = {}


class PluginResponse(BaseModel):
    id: UUID
    author_id: UUID
    name: str
    slug: str
    description: str
    manifest: Dict[str, Any]
    bundle_url: str
    version: str
    category: str
    is_published: bool
    is_verified: bool
    installs: int
    created_at: datetime
    updated_at: datetime


class TenantResponse(BaseModel):
    id: UUID
    owner_id: UUID
    slug: str
    name: str
    custom_domain: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    favicon_url: Optional[str] = None
    features: Dict[str, Any] = {}
    plan: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TenantMemberResponse(BaseModel):
    tenant_id: UUID
    user_id: UUID
    role: str
    joined_at: datetime
    profile: Optional[Dict[str, Any]] = None


class TemplateResponse(BaseModel):
    id: UUID
    creator_id: Optional[UUID] = None
    title: str
    category: str
    document_model: Dict[str, Any]
    is_public: bool
    uses_count: int
    thumbnail_url: Optional[str] = None
    created_at: datetime
