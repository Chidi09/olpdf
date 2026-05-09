"""PDF import routing: classify pages, extract native text, dispatch OCR worker."""
import os
from io import BytesIO
from typing import Any, Dict, List

import pdfplumber

from ...core.supabase_client import supabase
from ...core.security import sanitize_document_model
from ...engine.extractor import extract_page_blocks_from_pdf


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


def _safe_insert_page_metadata(rows: list) -> None:
    if not rows:
        return
    try:
        supabase.table("page_metadata").insert(rows).execute()
    except Exception:
        return


async def route_pdf_import(
    file_bytes: bytes,
    document_id: str,
    layout_mode: str = "editable",
    request_id: str = "",
) -> dict:
    native_blocks: List[Dict[str, Any]] = []
    pages_needing_ocr: List[int] = []
    metadata_rows: list = []

    _safe_update_document(document_id, {"status": "processing", "import_progress": 5, "error": None})

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        pages_total = len(pdf.pages)
        if pages_total > 500:
            _safe_update_document(document_id, {"status": "failed", "error": f"Document exceeds 500 pages (found {pages_total})."})
            return {"status": "failed", "error": "Document too long"}

        for idx, page in enumerate(pdf.pages):
            classification = classify_page(page)
            metadata_rows.append({"document_id": document_id, "page_number": idx + 1, **classification})

            if classification["extraction_strategy"] == "native":
                native_blocks.extend(extract_page_blocks_from_pdf(file_bytes, idx))
            else:
                pages_needing_ocr.append(idx)

            _safe_update_document(document_id, {"import_progress": min(95, int(((idx + 1) / max(pages_total, 1)) * 90) + 5)})

    _safe_insert_page_metadata(metadata_rows)

    if native_blocks:
        sanitized = sanitize_document_model({"blocks": native_blocks})
        _safe_update_document(document_id, {
            "document_model": sanitized,
            "status": "partial" if pages_needing_ocr else "ready",
        })

    if pages_needing_ocr:
        ocr_worker_url = os.environ.get("OCR_WORKER_URL")
        worker_secret = os.environ.get("WORKER_SECRET", "")
        if ocr_worker_url:
            import httpx
            headers = {
                "Content-Type": "application/json",
                "X-Worker-Secret": worker_secret,
            }
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{ocr_worker_url.rstrip('/')}/worker/process-ocr",
                        headers=headers,
                        json={"document_id": document_id, "page_indices": pages_needing_ocr},
                    )
            except Exception as e:
                print(f"[import] OCR worker dispatch failed: {e}")

    final_status = "partial" if pages_needing_ocr else "ready"
    _safe_update_document(document_id, {"status": final_status, "import_progress": 100})

    try:
        from ...services.notification_service import notify_import_complete, notify_ocr_partial
        doc_row = supabase.table("documents").select("title, user_id").eq("id", document_id).single().execute()
        if doc_row.data:
            title = doc_row.data.get("title", "Your document")
            user_id = doc_row.data.get("user_id")
            if user_id:
                if final_status == "ready":
                    notify_import_complete(user_id, title, document_id)
                else:
                    notify_ocr_partial(user_id, title, document_id, len(pages_needing_ocr))
    except Exception:
        pass

    return {
        "status": final_status,
        "document_id": document_id,
        "pages_total": len(metadata_rows),
        "pages_native": len(metadata_rows) - len(pages_needing_ocr),
        "pages_ocr": len(pages_needing_ocr),
        "page_metadata": metadata_rows,
    }


async def index_chapter_embeddings(chapter_id: str) -> None:
    """RAG embedding indexer — extract text from chapter and store vectors."""
    import os
    try:
        import google.generativeai as genai
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            if os.environ.get("OLPDF_DEV_MODE") == "true":
                return
            raise ValueError("GEMINI_API_KEY not configured")
        genai.configure(api_key=api_key)

        ch_res = supabase.table("book_chapters").select("*").eq("id", chapter_id).single().execute()
        chapter = ch_res.data
        doc_res = supabase.table("documents").select("document_model").eq("id", chapter["document_id"]).single().execute()
        blocks = doc_res.data["document_model"]["blocks"]
        chunks = [b["content"] for b in blocks if b["type"] in ("paragraph", "text") and b.get("content")]
        if not chunks:
            return

        embed_res = genai.embed_content(model="models/text-embedding-004", content=chunks, task_type="retrieval_document")
        embeddings = embed_res["embedding"]

        rows = [
            {"book_id": chapter["book_id"], "chapter_id": chapter_id, "chunk_index": i, "content": c, "embedding": e}
            for i, (c, e) in enumerate(zip(chunks, embeddings))
        ]
        supabase.table("chapter_embeddings").delete().eq("chapter_id", chapter_id).execute()
        supabase.table("chapter_embeddings").insert(rows).execute()
        supabase.table("book_chapters").update({"embedding_indexed": True}).eq("id", chapter_id).execute()
    except Exception as e:
        print(f"Failed to index chapter {chapter_id}: {e}")
