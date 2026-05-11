"""All inbound Pydantic request bodies."""
from pydantic import BaseModel, Base64Bytes, Field, ConfigDict
from typing import Any, Dict, List, Literal, Optional, Annotated

from .document import DocumentModel


class ExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_model: DocumentModel
    font_metrics: Optional[Dict[str, Dict[str, float]]] = None


class ImportStartPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: str = Field(min_length=1, max_length=100)
    file_bytes: Base64Bytes
    layout_mode: Literal["editable", "fidelity"] = "editable"


class WorkerImportPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: str = Field(min_length=1, max_length=100)
    file_bytes: Base64Bytes
    source: Literal["qstash", "direct"] = "qstash"


class WorkerOcrPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: str = Field(min_length=1, max_length=100)
    page_indices: List[Annotated[int, Field(ge=0)]]
    source: Literal["qstash", "direct"] = "qstash"


class DocumentSnapshotPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_model: DocumentModel
    version_name: Optional[Annotated[str, Field(max_length=100)]] = None


class AiInstructionPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    instruction: str = Field(min_length=1, max_length=5000)


class PdfRedactionArea(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page_number: int = Field(ge=0)
    bbox: Annotated[List[float], Field(min_length=4, max_length=4)]


class PdfRedactionPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    areas: List[PdfRedactionArea]


class PdfPageRange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start: int = Field(default=0, ge=0)
    end: int = Field(ge=0)


class PdfMergePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    doc_ids: List[Annotated[str, Field(min_length=1, max_length=100)]]


class PdfSplitPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page_ranges: List[PdfPageRange]


class PdfRotatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rotation: Literal[90, 180, 270]
    page_indices: Optional[List[Annotated[int, Field(ge=0)]]] = None


class PdfWatermarkPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=255)
    opacity: float = Field(default=0.3, ge=0.0, le=1.0)


class PdfProtectPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_password: str = Field(min_length=1, max_length=100)
    owner_password: Optional[Annotated[str, Field(max_length=100)]] = None


class WebhookCreatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(max_length=2000, pattern=r"^https?://")
    events: List[str]


class ApiKeyCreatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    scopes: List[str] = Field(default_factory=list)
    expires_at: Optional[str] = None


class SignatureRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: str = Field(min_length=1, max_length=100)
    signers: List[Annotated[str, Field(max_length=255, pattern=r"^[^@]+@[^@]+\.[^@]+$")]]


class SignatureSubmitPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    signature_data: str = Field(min_length=1, max_length=1000000)


class WorkspaceCreatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)


class WorkspaceUpdatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = Field(None, min_length=1, max_length=100)


# AI tool call schemas
class RewriteBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")
    block_id: str = Field(min_length=1, max_length=100)
    new_content: str = Field(max_length=100000)
    reason: str = Field(max_length=1000)


class InsertBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")
    after_block_id: str = Field(min_length=1, max_length=100)
    block_type: Literal["paragraph", "heading1", "heading2", "heading3", "callout", "table", "list", "divider", "page_break"]
    content: str = Field(max_length=100000)


class DeleteBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")
    block_id: str = Field(min_length=1, max_length=100)


class ReorderBlocks(BaseModel):
    model_config = ConfigDict(extra="forbid")
    block_ids_in_order: List[Annotated[str, Field(min_length=1, max_length=100)]]


class UpdateStyle(BaseModel):
    model_config = ConfigDict(extra="forbid")
    property: Literal["font_family", "base_font_size", "line_height", "margin_top", "margin_bottom", "heading1_color", "body_color"]
    value: str = Field(max_length=100)


class PluginSubmitPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=60, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str = Field(max_length=1000)
    manifest: Dict[str, Any]
    bundle_url: str = Field(max_length=2000, pattern=r"^https://")
    version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    category: str = Field(max_length=50)


class TenantCreatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=60, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class TenantBrandingPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    logo_url: Optional[str] = Field(None, max_length=2000, pattern=r"^https://")
    primary_color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    accent_color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    favicon_url: Optional[str] = Field(None, max_length=2000, pattern=r"^https://")
    custom_domain: Optional[str] = Field(None, max_length=255)


class TenantMemberAddPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str
    role: Literal["admin", "member"] = "member"

class PublishTemplatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=50)
    description: str = Field(max_length=1000)
