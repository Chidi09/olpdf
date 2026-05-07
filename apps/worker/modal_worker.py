import base64
import hashlib
import hmac
import io
import json
import os
from typing import Any

import modal
from fastapi import APIRouter, FastAPI, HTTPException, Request

app = modal.App("olpdf-ocr-worker")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "surya-ocr==0.6.15",
        "opencv-python-headless",
        "httpx",
        "supabase",
        "pymupdf",
        "Pillow",
    )
)


def _verify_qstash(raw_body: bytes, signature: str | None) -> bool:
    for env_key in ("QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY"):
        key = os.environ.get(env_key, "")
        if not key:
            continue
        digest = hmac.new(key.encode("utf-8"), raw_body, hashlib.sha256).digest()
        expected = base64.b64encode(digest).decode("utf-8")
        if signature and hmac.compare_digest(expected, signature):
            return True
    return os.environ.get("OLPDF_DEV_MODE") == "true"


def _estimate_font_meta(bbox: list[float], zoom: float = 2.0) -> dict[str, Any]:
    height_pts = max((bbox[3] - bbox[1]) / zoom, 1.0)
    return {
        "family": "Unknown",
        "size": round(height_pts * 0.75, 1),
        "color": "#000000",
        "is_bold": False,
        "is_italic": False,
    }


def _infer_block_type(text: str, bbox: list[float]) -> str:
    height = max(bbox[3] - bbox[1], 0.0)
    stripped = text.strip()
    if height > 40:
        return "heading1"
    if height > 28:
        return "heading2"
    if stripped.startswith("-") or stripped.startswith("*") or stripped.startswith("•"):
        return "list"
    return "paragraph"


@app.function(gpu="T4", image=image, secrets=[modal.Secret.from_name("olpdf-secrets")], memory=8192)
def process_ocr_pages(document_id: str, page_indices: list[int]) -> dict[str, Any]:
    import fitz
    import httpx
    from PIL import Image as PILImage
    from supabase import create_client
    from surya.model.detection.segformer import load_model as load_det_model, load_processor as load_det_processor
    from surya.model.recognition.model import load_model as load_rec_model
    from surya.model.recognition.processor import load_processor as load_rec_processor
    from surya.ocr import run_ocr

    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    storage_bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "user-uploads")
    worker_secret = os.environ.get("WORKER_SECRET", "")
    api_base_url = os.environ.get("OLPDF_API_BASE_URL", "").rstrip("/")

    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    if not page_indices:
        return {"status": "success", "document_id": document_id, "blocks_added": 0}

    client = create_client(supabase_url, supabase_key)

    doc_row = client.table("documents").select("file_url, document_model").eq("id", document_id).single().execute()
    if not doc_row.data:
        client.table("documents").update({"status": "failed", "error": "document_not_found"}).eq("id", document_id).execute()
        return {"status": "failed", "document_id": document_id, "error": "document_not_found"}

    file_url = doc_row.data.get("file_url")
    if not file_url:
        client.table("documents").update({"status": "failed", "error": "file_url_missing"}).eq("id", document_id).execute()
        return {"status": "failed", "document_id": document_id, "error": "file_url_missing"}

    storage_path = str(file_url).split("/")[-1]
    try:
        pdf_bytes = client.storage.from_(storage_bucket).download(storage_path)
    except Exception:
        client.table("documents").update({"status": "failed", "error": "storage_download_failed"}).eq("id", document_id).execute()
        return {"status": "failed", "document_id": document_id, "error": "storage_download_failed"}

    pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    det_model, det_processor = load_det_model(), load_det_processor()
    rec_model, rec_processor = load_rec_model(), load_rec_processor()

    zoom = 2.0
    all_ocr_blocks: list[dict[str, Any]] = []
    failed_pages: list[int] = []

    for idx in page_indices:
        if idx < 0 or idx >= len(pdf_doc):
            continue

        try:
            page = pdf_doc[idx]
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
            image_bytes = pix.tobytes("png")
            pil_image = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")

            ocr_batches = run_ocr([pil_image], [["en"]], det_model, det_processor, rec_model, rec_processor)
            if not ocr_batches:
                continue

            for line_idx, line in enumerate(ocr_batches[0].text_lines):
                bbox = [float(v) / zoom for v in line.bbox]
                text = str(line.text or "").strip()
                if not text:
                    continue
                confidence = float(getattr(line, "confidence", 0.0))
                all_ocr_blocks.append(
                    {
                        "id": f"blk_ocr_{idx}_{line_idx}",
                        "type": _infer_block_type(text, bbox),
                        "content": text,
                        "confidence_score": confidence,
                        "needs_review": confidence < 0.8,
                        "bounding_box": bbox,
                        "style_overrides": {},
                        "font_meta": _estimate_font_meta(bbox, zoom=1.0),
                        "z_index": 0,
                        "page_index": idx,
                    }
                )
        except Exception as e:
            print(f"Error processing page {idx}: {e}")
            failed_pages.append(idx)

    current_model = doc_row.data.get("document_model") or {}
    current_blocks = list((current_model.get("blocks") or []))
    
    # Deduplicate: remove existing blocks with IDs that match our new OCR blocks
    new_block_ids = {b["id"] for b in all_ocr_blocks}
    filtered_current_blocks = [b for b in current_blocks if b.get("id") not in new_block_ids]

    final_blocks = sorted(
        filtered_current_blocks + all_ocr_blocks,
        key=lambda b: (b.get("page_index", 0), ((b.get("bounding_box") or [0, 0])[1])),
    )

    merged_model = dict(current_model)
    merged_model["blocks"] = final_blocks

    final_status = "ready" if not failed_pages else "partial"
    if len(failed_pages) == len(page_indices):
        final_status = "failed"

    client.table("documents").update(
        {
            "document_model": merged_model,
            "status": final_status,
            "import_progress": 100,
            "error": f"Failed pages: {failed_pages}" if failed_pages else None,
        }
    ).eq("id", document_id).execute()

    # Retry callback logic
    callback_sent = False
    callback_url = f"{api_base_url}/api/worker/ocr-complete" if api_base_url else ""
    if callback_url:
        headers = {"Content-Type": "application/json"}
        if worker_secret:
            headers["X-Worker-Secret"] = worker_secret
        payload = {
            "document_id": document_id,
            "status": final_status,
            "pages_ocr": len(page_indices),
            "failed_pages": failed_pages,
            "blocks_added": len(all_ocr_blocks),
        }
        
        import time
        for attempt in range(3):
            try:
                with httpx.Client(timeout=30.0) as http_client:
                    response = http_client.post(callback_url, headers=headers, json=payload)
                    if response.status_code < 400:
                        callback_sent = True
                        break
            except Exception as e:
                print(f"Callback attempt {attempt + 1} failed: {e}")
            time.sleep(2 ** attempt) # Exponential backoff

    return {
        "status": "success",
        "document_id": document_id,
        "pages": len(page_indices),
        "blocks_added": len(all_ocr_blocks),
        "callback_sent": callback_sent,
    }


router = APIRouter(prefix="/worker")


@router.post("/process-ocr")
async def process_ocr(request: Request) -> dict[str, str]:
    raw_body = await request.body()
    signature = request.headers.get("Upstash-Signature")
    if not _verify_qstash(raw_body, signature):
        raise HTTPException(status_code=401, detail="Invalid QStash signature")

    payload = json.loads(raw_body)
    document_id = str(payload.get("document_id", "")).strip()
    page_indices = payload.get("page_indices") or []
    if not document_id or not isinstance(page_indices, list):
        raise HTTPException(status_code=400, detail="Invalid payload")

    process_ocr_pages.spawn(document_id, [int(p) for p in page_indices])
    return {"status": "accepted"}


@app.function(image=image, secrets=[modal.Secret.from_name("olpdf-secrets")])
@modal.asgi_app()
def worker_api() -> FastAPI:
    web_app = FastAPI()
    web_app.include_router(router)
    return web_app
