from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, List, Literal, Optional, Annotated

HEX_COLOR = r"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"


class FontMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")
    family: str = Field(default="Helvetica", max_length=100)
    size: float = Field(default=11.0, gt=0, le=500)
    color: str = Field(default="#000000", pattern=HEX_COLOR)
    is_bold: bool = False
    is_italic: bool = False


class PageDimension(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page_index: int = Field(ge=0)
    width: float = Field(gt=0)
    height: float = Field(gt=0)


class DocumentMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(default="Untitled Document", max_length=255)
    author: Optional[Annotated[str, Field(max_length=255)]] = None
    page_size: Literal["A4", "letter"] = "A4"
    margins: Dict[str, Annotated[int, Field(ge=0, le=1000)]] = {"top": 72, "bottom": 72, "left": 72, "right": 72}
    export_standard: Literal["standard", "pdf_a", "tagged"] = "standard"
    layout_mode: Literal["editable", "fidelity"] = "editable"
    color_space: Literal["rgb", "cmyk"] = "rgb"
    native_pdf: Optional[bool] = None
    original_pdf_key: Optional[str] = Field(default=None, max_length=500)
    native_pdf_session: Optional[Dict[str, Any]] = None
    import_status: Optional[str] = Field(default=None, max_length=20)


class RichSpan(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(default="", max_length=10000)
    bold: bool = False
    italic: bool = False
    underline: bool = False
    strikethrough: bool = False
    color: Optional[str] = None
    font_family: Optional[str] = None
    font_size: Optional[float] = None
    link_href: Optional[str] = None
    mark: bool = False


class DocumentBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=100)
    type: str = Field(max_length=50)
    content: Optional[str] = Field(default=None, max_length=100000)
    rich_spans: List[RichSpan] = []
    next_block_id: Optional[str] = Field(default=None, max_length=100)
    column_index: int = Field(default=0, ge=0)
    alignment: Optional[str] = Field(default=None, max_length=20)
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0)
    needs_review: bool = False
    bounding_box: Optional[Annotated[List[float], Field(min_length=4, max_length=4)]] = None
    style_overrides: Dict[str, Any] = {}
    fabric_data: Optional[Dict[str, Any]] = None
    font_meta: Optional[FontMeta] = None
    z_index: int = Field(default=0, ge=-1000, le=10000)
    page_index: int = Field(default=0, ge=0)


class DocumentModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: Optional[str] = Field(default=None, max_length=100)
    meta: DocumentMeta = DocumentMeta()
    styles: Dict[str, Any] = {}
    blocks: List[DocumentBlock] = []
    page_dimensions: List[PageDimension] = []


class BookChapter(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: Optional[str] = Field(default=None, max_length=100)
    title: str = Field(max_length=255)
    chapter_number: int = Field(gt=0)
    status: Literal["draft", "review", "final"] = "draft"
    word_count: int = Field(default=0, ge=0)
    document_id: Optional[str] = Field(default=None, max_length=100)


class BookModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: Optional[str] = Field(default=None, max_length=100)
    title: str = Field(max_length=255)
    meta: Dict[str, Any] = {}
    chapters: List[BookChapter] = []
