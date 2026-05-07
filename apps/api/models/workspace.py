from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class WorkspaceCreatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)


class WorkspaceUpdatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = Field(None, min_length=1, max_length=100)
