from fastapi import APIRouter, Depends
from typing import Any, Dict

from ..auth_utils import require_auth

router = APIRouter(prefix="/v1", tags=["v1"])


@router.get("/health")
async def v1_health() -> dict:
    return {"status": "ok"}


@router.post("/extract")
async def v1_extract(
    payload: Dict[str, Any],
    user: dict = Depends(require_auth),
) -> dict:
    return {
        "status": "accepted",
        "mode": payload.get("mode", "semantic"),
        "blocks": [],
    }
