"""Magic AI Orchestrator API endpoints — SSE with thought/action/observation events."""

import asyncio
import json
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from ..auth_utils import require_auth
from ..core.auth import check_ownership
from ..services.magic_orchestrator import get_job, run_magic, _jobs

router = APIRouter(prefix="/api/pdf/magic", tags=["magic"])


@router.post("/execute")
async def magic_execute(
    request: Request,
    body: dict,
    user: dict = Depends(require_auth),
) -> dict:
    """Start a Magic AI orchestration job."""
    doc_id = body.get("document_id", "")
    instruction = body.get("instruction", "").strip()

    if not doc_id:
        raise HTTPException(status_code=422, detail="document_id is required")
    if not instruction:
        raise HTTPException(status_code=422, detail="instruction is required")

    check_ownership(doc_id, user)
    job_id = str(uuid.uuid4())

    _jobs[job_id] = {
        "id": job_id,
        "document_id": doc_id,
        "instruction": instruction,
        "status": "queued",
        "step": "Queued...",
        "steps": [],
        "events": [],
        "url": None,
        "error": None,
        "analysis": None,
        "summary": None,
        "user_id": user.get("sub", "unknown"),
        "created_at": time.time(),
        "updated_at": time.time(),
    }

    asyncio.create_task(run_magic(doc_id, instruction, job_id))

    return {"job_id": job_id, "status": "queued"}


@router.get("/stream/{job_id}")
async def magic_stream(job_id: str):
    """SSE endpoint streaming Magic AI ReAct events."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        last_event_index = -1
        last_step = None

        while True:
            current = get_job(job_id)
            if not current:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Job expired'})}\n\n"
                break

            current_status = current.get("status", "running")
            events = current.get("events", [])
            steps = current.get("steps", [])

            # Emit new events (thought/action/observation)
            while last_event_index + 1 < len(events):
                last_event_index += 1
                evt = events[last_event_index]
                yield f"data: {json.dumps(evt)}\n\n"

            # Emit step changes (backward-compatible with old client)
            current_step = current.get("step", "")
            if current_step != last_step:
                last_step = current_step
                data = {
                    "type": "step",
                    "status": current_status,
                    "step": current_step,
                    "steps": steps,
                }
                if current_status == "completed":
                    if current.get("url"):
                        data["url"] = current["url"]
                    if current.get("analysis"):
                        data["analysis"] = current["analysis"]
                    if current.get("summary"):
                        data["summary"] = current["summary"]
                if current_status == "error":
                    data["error"] = current.get("error", "Unknown error")
                yield f"data: {json.dumps(data)}\n\n"

            if current_status in ("completed", "error"):
                # Emit a final completion/error event with type
                if current_status == "completed":
                    final = {
                        "type": "complete",
                        "status": "completed",
                        "url": current.get("url"),
                        "summary": current.get("summary"),
                        "analysis": current.get("analysis"),
                    }
                    yield f"data: {json.dumps(final)}\n\n"
                else:
                    final = {
                        "type": "error",
                        "status": "error",
                        "message": current.get("error", "Unknown error"),
                    }
                    yield f"data: {json.dumps(final)}\n\n"
                break

            await asyncio.sleep(0.3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Poll job status directly."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
