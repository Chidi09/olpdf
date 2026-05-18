"""Magic AI Orchestrator — job management and SSE-friendly wrapper around MagicAgent."""

import asyncio
import time
import uuid
from typing import Any, Dict, List, Optional

import logging

from .magic_agent import MagicAgent

logger = logging.getLogger(__name__)

# ── In-memory job store (replace with Redis for production) ────────────
_jobs: Dict[str, Dict[str, Any]] = {}
_MAX_JOBS = 100


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    return _jobs.get(job_id)


def update_job(job_id: str, **kwargs):
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)


def _cleanup_jobs():
    if len(_jobs) > _MAX_JOBS:
        excess = sorted(
            _jobs.keys(),
            key=lambda k: _jobs[k].get("created_at", 0),
        )[: len(_jobs) - _MAX_JOBS]
        for k in excess:
            del _jobs[k]


async def run_magic(doc_id: str, instruction: str, job_id: str) -> None:
    """Run the ReAct MagicAgent and stream events into the job store."""
    try:
        update_job(job_id, status="running", step="Thinking...", steps=[], events=[])
        agent = MagicAgent()

        async for event in agent.run(doc_id, instruction):
            event_type = event.get("type", "")

            # Append to timeline steps for backward-compatible SSE
            steps = _jobs[job_id].setdefault("steps", [])
            events = _jobs[job_id].setdefault("events", [])

            if event_type == "thought":
                _jobs[job_id]["step"] = event.get("content", "Thinking...")
                events.append(event)

            elif event_type == "action":
                tool = event.get("tool", "")
                args = event.get("args", {})
                step_label = f"Running {tool}..."
                steps.append(step_label)
                _jobs[job_id]["step"] = step_label
                events.append(event)

            elif event_type == "observation":
                events.append(event)

            elif event_type == "complete":
                steps.append("Done")
                _jobs[job_id].update(
                    step="Done",
                    status="completed",
                    url=event.get("url"),
                    summary=event.get("summary"),
                    analysis=event.get("analysis"),
                )

            elif event_type == "error":
                _jobs[job_id].update(
                    step=f"Error: {event.get('message', '')}",
                    status="error",
                    error=event.get("message"),
                )
                return

            _jobs[job_id]["updated_at"] = time.time()

    except Exception as e:
        logger.exception("Magic orchestrator failed")
        _jobs[job_id].update(
            step=f"Error: {e}",
            status="error",
            error=str(e),
        )
    finally:
        _cleanup_jobs()
