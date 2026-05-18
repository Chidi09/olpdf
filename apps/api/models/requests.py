"""All inbound Pydantic request bodies."""
from pydantic import BaseModel, Base64Bytes, Field, ConfigDict
from typing import Any, Dict, List, Literal, Optional, Annotated, Union

from .document import DocumentModel


class LayoutObjectPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    type: str
    x: float
    y: float
    width: float
    height: float
    rotation: float = 0
    content: Optional[str] = None
    src: Optional[str] = None
    fontFamily: Optional[str] = None
    fontSize: Optional[float] = None
    fill: Optional[str] = None
    stroke: Optional[str] = None


class LayoutPagePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    index: int
    width: float
    height: float
    objects: List[LayoutObjectPayload] = []


class LayoutPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_kind: str = "imported_pdf"
    original_pdf_key: Optional[str] = None
    pages: List[LayoutPagePayload] = []
    export_strategy: Literal["preserve_original", "regenerate"] = "preserve_original"


class LayoutOperationPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: str
    page_id: Optional[str] = None
    pageId: Optional[str] = None
    object_id: Optional[str] = None
    objectId: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    content: Optional[str] = None


class ExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_model: DocumentModel
    font_metrics: Optional[Dict[str, Dict[str, float]]] = None
    layout_payload: Optional[Dict[str, Any]] = None
    original_object_key: Optional[str] = None
    operations: Optional[List[Union[Dict[str, Any], LayoutOperationPayload]]] = []


class ImportStartPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: str = Field(min_length=1, max_length=100)
    file_bytes: Base64Bytes
    layout_mode: Literal["editable", "fidelity"] = "editable"
    client_model: Optional[Dict[str, Any]] = None


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


class PdfPageNumberPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(default="Page {n}", max_length=100)
    start_number: int = Field(default=1, ge=0)
    position: str = Field(default="bottom_center", pattern=r"^(top|bottom)_(left|center|right)$")


class PdfHeaderFooterPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=500)


class PdfMetadataPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Optional[str] = Field(None, max_length=200)
    author: Optional[str] = Field(None, max_length=200)
    subject: Optional[str] = Field(None, max_length=500)
    keywords: Optional[str] = Field(None, max_length=500)


class PdfBackgroundPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    color: str = Field(default="#ffffff", pattern=r"^#[0-9a-fA-F]{6}$")


class PdfStampPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=200)
    opacity: float = Field(default=0.3, ge=0.0, le=1.0)


class PdfReplaceTextPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    find_text: str = Field(min_length=1, max_length=500)
    replace_text: str = Field(default="", max_length=500)


class PdfBatesPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prefix: str = Field(default="BATES", max_length=50)
    start_number: int = Field(default=1, ge=0)


class PdfCropPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    x1: float = Field(ge=0)
    y1: float = Field(ge=0)
    x2: float = Field(ge=0)
    y2: float = Field(ge=0)
    page_indices: Optional[List[int]] = None


class PdfExtractPagesPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page_ranges: List[PdfPageRange]


class PdfDeletePagesPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page_indices: List[int]


class PdfReorderPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    new_order: List[int]


class PdfScalePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_size: Literal["A4", "Letter", "Legal"]


class PdfMarginsPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    margin_size: float = Field(default=36, ge=0, le=200)


class PdfResizePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    width: float = Field(ge=72)
    height: float = Field(ge=72)


class PdfSplitSizePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    max_mb: float = Field(default=10, ge=1, le=500)


class PdfNUpPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pages_per_sheet: Literal[2, 4, 6, 8, 16]


class PdfInitialViewPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    zoom: str = Field(default="fit_page", pattern=r"^(fit_page|fit_width|100%|75%|50%)$")
    layout: str = Field(default="single", pattern=r"^(single|continuous|facing)$")


class PdfRemovePasswordPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1, max_length=100)


class PdfRedactTextPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pattern: str = Field(min_length=1, max_length=500)
    replacement: Optional[str] = Field(None, max_length=500)


class PdfComparePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    compare_doc_id: str = Field(min_length=1, max_length=100)


class PdfSignPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=200)


class PdfToImagesPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    format: Literal["png", "jpg"] = "png"
    dpi: int = Field(default=150, ge=72, le=600)
