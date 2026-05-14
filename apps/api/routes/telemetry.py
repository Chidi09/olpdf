import logging

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from ..auth_utils import require_auth
from ..limiter import limiter

logger = logging.getLogger("olpdf-api")

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


class ExportTelemetryPayload(BaseModel):
    documentId: str
    layoutMode: str
    format: str
    elapsedMs: int
    phase: str
    errorClass: str | None = None


@router.post("/export", status_code=202)
@limiter.limit("60/minute")
async def capture_export_telemetry(
    request: Request,
    payload: ExportTelemetryPayload,
    user: dict = Depends(require_auth),
) -> dict:
    logger.info(
        "Export telemetry received",
        extra={
            "request_id": request.headers.get("X-Request-ID", "unknown"),
        },
    )
    return {"status": "accepted"}
