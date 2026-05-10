import logging
from io import BytesIO
from typing import Any

import pdfplumber

from .supabase_client import supabase
from .security_utils import sanitize_document_model

logger = logging.getLogger("olpdf-api.worker_utils")


def classify_page(page: Any) -> dict:
    words = page.extract_words() or []
    images = page.images or []
    text_coverage = len(words) / max(page.width * page.height / 100, 1)
    image_area = sum(img["width"] * img["height"] for img in images)
    image_ratio = image_area / max(page.width * page.height, 1)
    tables = page.find_tables() or []

    if text_coverage > 0.8:
        strategy, page_type = "native", "text"
    elif text_coverage < 0.2 and image_ratio > 0.5:
        strategy, page_type = "ocr", "scanned"
    elif len(tables) >= 2:
        strategy, page_type = "table_extraction", "table_heavy"
    elif image_ratio > 0.6:
        strategy, page_type = "vision_preserve", "image_heavy"
    else:
        strategy, page_type = "native", "text"

    return {
        "page_type": page_type,
        "extraction_strategy": strategy,
        "text_layer_ratio": min(text_coverage, 1.0),
        "table_likelihood": min(len(tables) / 5, 1.0),
        "image_ratio": min(image_ratio, 1.0),
        "confidence_score": 0.95 if strategy == "native" else 0.7,
        "needs_review": strategy != "native",
    }


def _safe_update_document(document_id: str, payload: dict) -> None:
    try:
        supabase.table("documents").update(payload).eq("id", document_id).execute()
    except Exception:
        return


def _safe_insert_page_metadata(rows: list[dict]) -> None:
    if not rows:
        return

    try:
        supabase.table("page_metadata").insert(rows).execute()
    except Exception:
        return


import google.generativeai as genai
import os

def _get_embeddings(texts: list[str]) -> list[list[float]]:
    """Helper to fetch real embeddings from Gemini."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        if os.environ.get("OLPDF_DEV_MODE") == "true":
             return [[0.1] * 768] * len(texts)
        raise ValueError("GEMINI_API_KEY is not configured and OLPDF_DEV_MODE is not true.")

    genai.configure(api_key=api_key)
    res = genai.embed_content(
        model="models/text-embedding-004",
        content=texts,
        task_type="retrieval_document"
    )
    return res["embedding"]

async def index_chapter_embeddings(chapter_id: str) -> None:
    """Extract text from chapter blocks and index them for RAG using real embeddings."""
    try:
        # Fetch chapter and its document_id
        ch_res = supabase.table("book_chapters").select("*").eq("id", chapter_id).single().execute()
        chapter = ch_res.data
        doc_id = chapter["document_id"]
        book_id = chapter["book_id"]

        # Fetch document blocks
        doc_res = supabase.table("documents").select("document_model").eq("id", doc_id).single().execute()        
        blocks = doc_res.data["document_model"]["blocks"]

        # Extract content chunks
        chunks = [b["content"] for b in blocks if b["type"] in ["paragraph", "text"] and b.get("content")]

        if not chunks:
            return

        # Fetch real embeddings
        embeddings = _get_embeddings(chunks)

        # Prepare records for chapter_embeddings table
        embedding_rows = []
        for idx, (content, vector) in enumerate(zip(chunks, embeddings)):
            embedding_rows.append({
                "book_id": book_id,
                "chapter_id": chapter_id,
                "chunk_index": idx,
                "content": content,
                "embedding": vector
            })

        # Clear old embeddings and insert new ones
        supabase.table("chapter_embeddings").delete().eq("chapter_id", chapter_id).execute()
        supabase.table("chapter_embeddings").insert(embedding_rows).execute()

        # Mark as indexed
        supabase.table("book_chapters").update({"embedding_indexed": True}).eq("id", chapter_id).execute()        

    except Exception as e:
        logger.error("Failed to index chapter %s: %s", chapter_id, e, exc_info=True)
        return

import json
import os
import uuid
from io import BytesIO
from typing import Any, List, Dict

import pdfplumber
from .supabase_client import supabase

def extract_native_page(page: Any, page_idx: int) -> List[Dict[str, Any]]:
    """Extracts text blocks from a native PDF page using pdfplumber."""
    blocks = []
    words = page.extract_words() or []

    for line_idx, line in enumerate(words):
        text = str(line.get("text", "")).strip()
        if not text:
            continue

        # Infer type from height (approximate font size)
        height = line.get("bottom", 0) - line.get("top", 0)
        btype = "paragraph"
        if height > 18:
            btype = "heading1"
        elif height > 14:
            btype = "heading2"

        font_name = str(line.get("fontname") or "Helvetica")
        font_size = float(line.get("size") or max(height, 10))
        blocks.append({
            "id": f"blk_native_{page_idx}_{line_idx}",
            "type": btype,
            "content": text,
            "confidence_score": 1.0,
            "needs_review": False,
            "bounding_box": [line.get("x0"), line.get("top"), line.get("x1"), line.get("bottom")],
            "style_overrides": {},
            "font_meta": {
                "family": font_name,
                "size": font_size,
                "color": "#000000",
                "is_bold": "bold" in font_name.lower(),
                "is_italic": "italic" in font_name.lower() or "oblique" in font_name.lower(),
            },
            "page_index": page_idx,
        })
    return blocks

async def route_pdf_import(file_bytes: bytes, document_id: str, layout_mode: str = "editable", request_id: str = "") -> dict:
    native_blocks: List[Dict[str, Any]] = []
    pages_needing_ocr: List[int] = []
    metadata_rows: list[dict] = []

    _safe_update_document(document_id, {"status": "processing", "import_progress": 5, "error": None})

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        pages_total = len(pdf.pages)

        # Cost guardrail: Hard limit on total pages to prevent OOM / runaway costs
        if pages_total > 500:
            _safe_update_document(document_id, {"status": "failed", "error": f"Document exceeds maximum allowed length of 500 pages (found {pages_total})."})
            return {"status": "failed", "error": "Document too long"}

        for idx, page in enumerate(pdf.pages):
            classification = classify_page(page)
            metadata_rows.append(
                {
                    "document_id": document_id,
                    "page_number": idx + 1,
                    **classification,
                }
            )

            if classification["extraction_strategy"] == "native":
                native_blocks.extend(extract_native_page(page, idx))
            else:
                pages_needing_ocr.append(idx)

            progress = min(95, int(((idx + 1) / max(pages_total, 1)) * 90) + 5)
            _safe_update_document(document_id, {"import_progress": progress})

    try:
        from .engine.extractor import extract_document_model_from_pdf

        extracted_model = extract_document_model_from_pdf(file_bytes)
        if extracted_model.get("blocks"):
            native_blocks = extracted_model.get("blocks", native_blocks)
            page_dimensions = extracted_model.get("page_dimensions", [])
        else:
            page_dimensions = []
    except Exception:
        page_dimensions = []

    # Save page metadata
    _safe_insert_page_metadata(metadata_rows)
    
    # Update document with native blocks
    if native_blocks:
        sanitized_model = sanitize_document_model({"blocks": native_blocks, "page_dimensions": page_dimensions})
        _safe_update_document(document_id, {
            "document_model": sanitized_model,
            "status": "partial" if pages_needing_ocr else "ready"
        })

    # Dispatch OCR jobs via QStash if needed
    if pages_needing_ocr:
        qstash_token = os.environ.get("QSTASH_TOKEN")
        worker_url = os.environ.get("MODAL_WORKER_URL")
        
        if qstash_token and worker_url:
            import httpx
            # QStash v2: destination URL is appended to the publish endpoint
            destination = f"{worker_url.rstrip('/')}/worker/process-ocr"
            headers = {
                "Authorization": f"Bearer {qstash_token}", 
                "Content-Type": "application/json",
                "Upstash-Idempotency-Key": f"ocr-{document_id}"
            }
            if request_id:
                headers["Upstash-Forward-X-Request-ID"] = request_id
                
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://qstash.upstash.io/v2/publish/{destination}",
                    headers=headers,
                    json={
                        "document_id": document_id,
                        "page_indices": pages_needing_ocr,
                        "source": "qstash",
                    }
                )

    final_status = "partial" if pages_needing_ocr else "ready"
    _safe_update_document(document_id, {"status": final_status, "import_progress": 100})

    # Auto-summary on completed imports (best-effort)
    if final_status == "ready":
        try:
            from .services.ai_service import summarise_document

            await summarise_document(document_id)
        except Exception:
            pass

    # Fire-and-forget email notification
    try:
        from .notification_utils import send_import_complete_notification, send_ocr_partial_notification
        from .supabase_client import supabase as _sb

        doc_row = _sb.table("documents").select("title, user_id").eq("id", document_id).single().execute()
        if doc_row.data:
            title = doc_row.data.get("title", "Your document")
            user_id = doc_row.data.get("user_id")
            if user_id:
                if final_status == "ready":
                    send_import_complete_notification(user_id, title, document_id)
                else:
                    send_ocr_partial_notification(user_id, title, document_id, len(pages_needing_ocr))
    except Exception:
        pass  # Notifications are best-effort; never block the import response

    return {
        "status": final_status,
        "document_id": document_id,
        "pages_total": len(metadata_rows),
        "pages_native": len(metadata_rows) - len(pages_needing_ocr),
        "pages_ocr": len(pages_needing_ocr),
        "page_metadata": metadata_rows,
    }
