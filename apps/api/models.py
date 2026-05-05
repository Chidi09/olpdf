from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
from uuid import UUID
from datetime import datetime

class DocumentMeta(BaseModel):
    title: str = "Untitled Document"
    author: Optional[str] = None
    page_size: Literal["A4", "letter"] = "A4"
    margins: Dict[str, int] = {"top": 72, "bottom": 72, "left": 72, "right": 72}
    export_standard: Literal["standard", "pdf_a", "tagged"] = "standard"
    layout_mode: Literal["editable", "fidelity"] = "editable"

class DocumentBlock(BaseModel):
    id: str
    type: str
    content: Optional[str] = None
    confidence_score: float = 1.0
    needs_review: bool = False
    bounding_box: Optional[List[float]] = None
    style_overrides: Dict[str, Any] = {}

class DocumentModel(BaseModel):
    id: Optional[str] = None
    meta: DocumentMeta = DocumentMeta()
    styles: Dict[str, Any] = {}
    blocks: List[DocumentBlock] = []

class BookChapter(BaseModel):
    id: Optional[str] = None
    title: str
    chapter_number: int
    status: Literal["draft", "review", "final"] = "draft"
    word_count: int = 0
    document_id: Optional[str] = None

class BookModel(BaseModel):
    id: Optional[str] = None
    title: str
    meta: Dict[str, Any] = {}
    chapters: List[BookChapter] = []

# AI Tool Call Schemas (Part VI)
class RewriteBlock(BaseModel):
    block_id: str
    new_content: str
    reason: str

class InsertBlock(BaseModel):
    after_block_id: str
    block_type: Literal["paragraph","heading1","heading2","heading3","callout","table","list","divider","page_break"]
    content: str

class DeleteBlock(BaseModel):
    block_id: str

class ReorderBlocks(BaseModel):
    block_ids_in_order: List[str]

class UpdateStyle(BaseModel):
    property: Literal["font_family","base_font_size","line_height","margin_top","margin_bottom","heading1_color","body_color"]
    value: str


class ImportStartPayload(BaseModel):
    document_id: str
    file_bytes: bytes


class WorkerImportPayload(BaseModel):
    document_id: str
    file_bytes: bytes
    source: Literal["qstash", "direct"] = "qstash"


class WorkerOcrPayload(BaseModel):
    document_id: str
    page_indices: List[int]
    source: Literal["qstash", "direct"] = "qstash"


class ImportStatusPayload(BaseModel):
    document_id: str
    status: Literal["queued", "processing", "partial", "ready", "failed"]
    import_progress: int = Field(default=0, ge=0, le=100)
    pages_total: int = 0
    pages_native: int = 0
    pages_ocr: int = 0
    error: Optional[str] = None


class DocumentSnapshotPayload(BaseModel):
    document_model: DocumentModel
    version_name: Optional[str] = None


class VersionHistoryEntry(BaseModel):
    id: UUID
    instruction: str
    status: str
    created_at: datetime
    version_name: Optional[str] = None


class AiInstructionPayload(BaseModel):
    instruction: str


class PdfRedactionArea(BaseModel):
    page_number: int
    bbox: List[float]


class PdfRedactionPayload(BaseModel):
    areas: List[PdfRedactionArea]
