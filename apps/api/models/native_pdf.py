from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, List, Literal, Optional, Annotated

HEX_COLOR = r"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"

PdfNativeObjectType = Literal["text", "image", "path", "shape", "annotation", "form_field"]

PdfRect = Annotated[List[float], Field(min_length=4, max_length=4)]

PdfEditOperationType = Literal["replace_text", "move_object", "resize_object", "delete_object", "insert_text", "insert_shape"]


class PdfNativeObject(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=100)
    page_index: int = Field(ge=0)
    type: PdfNativeObjectType
    bbox: PdfRect
    text: Optional[str] = Field(default=None, max_length=100000)
    font_family: Optional[str] = Field(default=None, max_length=255)
    font_size: Optional[float] = Field(default=None, gt=0, le=500)
    color: Optional[str] = Field(default=None, pattern=HEX_COLOR)
    z_index: Optional[int] = Field(default=None, ge=-1000, le=10000)
    source_ref: Optional[str] = Field(default=None, max_length=255)


class PdfEditOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=100)
    type: PdfEditOperationType
    page_index: int = Field(ge=0)
    target_object_id: str = Field(min_length=1, max_length=100)
    before: Dict[str, Any] = {}
    after: Dict[str, Any] = {}
    created_at: str = Field(min_length=1, max_length=100)


class PdfEditSessionPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page_index: int = Field(ge=0)
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    preview_url: Optional[str] = Field(default=None, max_length=1000)


class PdfEditSession(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: str = Field(min_length=1, max_length=100)
    original_object_key: str = Field(min_length=1, max_length=500)
    pages: List[PdfEditSessionPage] = []
    objects: List[PdfNativeObject] = []
    operations: List[PdfEditOperation] = []
