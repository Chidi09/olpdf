"""Self-hosted PaddleOCR worker — replaces Modal GPU dependency.

Accepts OCR jobs from the API, processes pages in the background,
writes blocks back to Supabase, then calls back to /api/worker/ocr-complete.

Deploy on any VPS with 4+ vCPUs and 8 GB RAM (e.g. Hetzner CX32 ~$7.40/mo).
"""
import io
import os
import time
from typing import Any

import cv2
import fitz  # PyMuPDF
import httpx
import numpy as np
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from paddleocr import PaddleOCR
from supabase import create_client

app = FastAPI(title="OLPDF OCR Worker")

# Initialise once at startup — downloads pre-trained models on first run
ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", use_gpu=False)

WORKER_SECRET = os.environ.get("WORKER_SECRET", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "user-uploads")
API_BASE_URL = os.environ.get("OLPDF_API_BASE_URL", "").rstrip("/")
DEV_MODE = os.environ.get("OLPDF_DEV_MODE") == "true"


def _verify_secret(request: Request) -> bool:
    if DEV_MODE:
        return True
    secret = request.headers.get("X-Worker-Secret", "")
    return bool(WORKER_SECRET) and secret == WORKER_SECRET


def _infer_block_type(text: str, bbox: list[float]) -> str:
    height = max(bbox[3] - bbox[1], 0.0)
    stripped = text.strip()
    if height > 40:
        return "heading1"
    if height > 28:
        return "heading2"
    if stripped and stripped[0] in ("-", "*", "•"):
        return "list"
    return "paragraph"


def _estimate_font_meta(bbox: list[float]) -> dict[str, Any]:
    height_pts = max(bbox[3] - bbox[1], 1.0)
    return {
        "family": "Unknown",
        "size": round(height_pts * 0.75, 1),
        "color": "#000000",
        "is_bold": False,
        "is_italic": False,
    }


def _process_ocr_pages(document_id: str, page_indices: list[int]) -> None:
    """Background task: fetch PDF, run PaddleOCR, merge blocks back into Supabase."""
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    def _fail(reason: str) -> None:
        client.table("documents").update({"status": "failed", "error": reason}).eq("id", document_id).execute()

    doc_row = client.table("documents").select("file_url, document_model").eq("id", document_id).single().execute()
    if not doc_row.data:
        _fail("document_not_found")
        return

    file_url = doc_row.data.get("file_url", "")
    storage_path = file_url.split("/")[-1]

    try:
        pdf_bytes = client.storage.from_(STORAGE_BUCKET).download(storage_path)
    except Exception:
        _fail("storage_download_failed")
        return

    pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    zoom = 2.0
    all_ocr_blocks: list[dict[str, Any]] = []
    failed_pages: list[int] = []

    for idx in page_indices:
        if idx < 0 or idx >= len(pdf_doc):
            continue
        try:
            page = pdf_doc[idx]
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            if pix.n == 3:
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            elif pix.n == 4:
                img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)

            result = ocr_engine.ocr(img, cls=True)
            if not result or not result[0]:
                continue

            for line_idx, line in enumerate(result[0]):
                box = line[0]  # [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
                text = str(line[1][0]).strip()
                confidence = float(line[1][1])
                if not text:
                    continue

                # Collapse rotated quad box → axis-aligned bbox, then de-zoom to PDF points
                xs = [p[0] for p in box]
                ys = [p[1] for p in box]
                bbox = [min(xs) / zoom, min(ys) / zoom, max(xs) / zoom, max(ys) / zoom]

                all_ocr_blocks.append({
                    "id": f"blk_ocr_{idx}_{line_idx}",
                    "type": _infer_block_type(text, bbox),
                    "content": text,
                    "confidence_score": confidence,
                    "needs_review": confidence < 0.8,
                    "bounding_box": bbox,
                    "style_overrides": {},
                    "font_meta": _estimate_font_meta(bbox),
                    "z_index": 0,
                    "page_index": idx,
                })
        except Exception as e:
            print(f"[ocr-worker] Page {idx} failed: {e}")
            failed_pages.append(idx)

    # Merge: keep existing non-OCR blocks, replace/add OCR blocks for processed pages
    current_model = doc_row.data.get("document_model") or {}
    current_blocks: list[dict] = list(current_model.get("blocks") or [])
    new_ids = {b["id"] for b in all_ocr_blocks}
    merged_blocks = sorted(
        [b for b in current_blocks if b.get("id") not in new_ids] + all_ocr_blocks,
        key=lambda b: (b.get("page_index", 0), (b.get("bounding_box") or [0, 0])[1]),
    )

    merged_model = {**current_model, "blocks": merged_blocks}
    n_failed = len(failed_pages)
    n_total = len(page_indices)
    final_status = "failed" if n_failed == n_total else ("partial" if n_failed else "ready")

    client.table("documents").update({
        "document_model": merged_model,
        "status": final_status,
        "import_progress": 100,
        "error": f"Failed pages: {failed_pages}" if failed_pages else None,
    }).eq("id", document_id).execute()

    # Callback to main API (3 attempts, exponential backoff)
    if API_BASE_URL:
        payload = {
            "document_id": document_id,
            "status": final_status,
            "pages_ocr": n_total,
            "failed_pages": failed_pages,
            "blocks_added": len(all_ocr_blocks),
        }
        headers = {"Content-Type": "application/json", "X-Worker-Secret": WORKER_SECRET}
        for attempt in range(3):
            try:
                with httpx.Client(timeout=30.0) as http:
                    r = http.post(f"{API_BASE_URL}/api/worker/ocr-complete", headers=headers, json=payload)
                    if r.status_code < 400:
                        break
            except Exception as e:
                print(f"[ocr-worker] Callback attempt {attempt + 1} failed: {e}")
            time.sleep(2 ** attempt)


@app.post("/worker/process-ocr")
async def process_ocr(request: Request, background_tasks: BackgroundTasks) -> dict[str, str]:
    if not _verify_secret(request):
        raise HTTPException(status_code=401, detail="Unauthorized")

    payload = await request.json()
    document_id = str(payload.get("document_id", "")).strip()
    page_indices = payload.get("page_indices") or []

    if not document_id or not isinstance(page_indices, list):
        raise HTTPException(status_code=400, detail="Invalid payload: document_id and page_indices required")

    background_tasks.add_task(_process_ocr_pages, document_id, [int(p) for p in page_indices])
    return {"status": "accepted"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
