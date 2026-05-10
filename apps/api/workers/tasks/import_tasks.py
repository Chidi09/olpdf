"""PDF import pipeline: classify pages, extract native text, OCR via Gemini Vision."""
import logging
from io import BytesIO
from typing import Any, Dict, List

import pdfplumber

from ...core.supabase_client import supabase
from ...core.security import sanitize_document_model
from ...engine.extractor import extract_page_blocks_from_pdf
from ...services.ocr_service import ocr_pages_with_gemini

logger = logging.getLogger("olpdf-api.import")


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
        strategy, page_type = "gemini_vision", "scanned"
    elif len(tables) >= 2:
        # Still extract natively — pdfplumber table detection is reliable
        strategy, page_type = "native", "table_heavy"
    elif image_ratio > 0.6:
        strategy, page_type = "gemini_vision", "image_heavy"
    else:
        strategy, page_type = "native", "text"

    return {
        "page_type": page_type,
        "extraction_strategy": strategy,
        "text_layer_ratio": min(text_coverage, 1.0),
        "table_likelihood": min(len(tables) / 5, 1.0),
        "image_ratio": min(image_ratio, 1.0),
        "confidence_score": 0.95 if strategy == "native" else 0.85,
        "needs_review": strategy != "native",
    }


def _safe_update_document(document_id: str, payload: dict) -> None:
    try:
        supabase.table("documents").update(payload).eq("id", document_id).execute()
    except Exception as e:
        logger.error("Failed to update document %s: %s", document_id, e)


def _safe_insert_page_metadata(rows: list) -> None:
    if not rows:
        return
    try:
        supabase.table("page_metadata").insert(rows).execute()
    except Exception as e:
        logger.error("Failed to insert page metadata: %s", e)


async def route_pdf_import(
    file_bytes: bytes,
    document_id: str,
    layout_mode: str = "editable",
    request_id: str = "",
) -> dict:
    try:
        return await _route_pdf_import_inner(file_bytes, document_id, layout_mode, request_id)
    except Exception as e:
        logger.error(
            "route_pdf_import crashed for document %s: %s",
            document_id, e, exc_info=True,
            extra={"request_id": request_id},
        )
        _safe_update_document(document_id, {
            "status": "failed",
            "error": "Import pipeline crashed unexpectedly",
        })
        return {"status": "failed", "document_id": document_id}


async def _route_pdf_import_inner(
    file_bytes: bytes,
    document_id: str,
    layout_mode: str = "editable",
    request_id: str = "",
) -> dict:
    native_blocks: List[Dict[str, Any]] = []
    pages_needing_vision: List[int] = []
    metadata_rows: list = []

    _safe_update_document(document_id, {"status": "processing", "import_progress": 5, "error": None})

    # ── Phase 1: Classify pages ────────────────────────────────────────────────
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        pages_total = len(pdf.pages)
        if pages_total > 500:
            _safe_update_document(document_id, {
                "status": "failed",
                "error": f"Document exceeds 500 pages (found {pages_total}).",
            })
            return {"status": "failed", "error": "Document too long"}

        for idx, page in enumerate(pdf.pages):
            classification = classify_page(page)
            metadata_rows.append({"document_id": document_id, "page_number": idx + 1, **classification})

            if classification["extraction_strategy"] == "native":
                native_blocks.extend(extract_page_blocks_from_pdf(file_bytes, idx))
            else:
                pages_needing_vision.append(idx)

            _safe_update_document(document_id, {
                "import_progress": min(80, int(((idx + 1) / max(pages_total, 1)) * 75) + 5),
            })

    _safe_insert_page_metadata(metadata_rows)

    # ── Phase 2: Gemini Vision OCR for scanned / image-heavy pages ────────────
    vision_blocks: List[Dict[str, Any]] = []
    if pages_needing_vision:
        logger.info(
            "document %s: %d pages need Gemini Vision OCR: %s",
            document_id, len(pages_needing_vision), pages_needing_vision,
        )
        _safe_update_document(document_id, {"import_progress": 82})
        vision_blocks = await ocr_pages_with_gemini(file_bytes, pages_needing_vision)

    # ── Phase 3: Merge blocks in page order and persist ───────────────────────
    all_blocks = sorted(
        native_blocks + vision_blocks,
        key=lambda b: (b.get("page_index", 0), b.get("id", "")),
    )

    if all_blocks:
        sanitized = sanitize_document_model({"blocks": all_blocks})
        _safe_update_document(document_id, {
            "document_model": sanitized,
            "status": "ready",
            "import_progress": 95,
        })

    _safe_update_document(document_id, {"status": "ready", "import_progress": 100})

    # ── Phase 4: Notifications ────────────────────────────────────────────────
    try:
        from ...services.notification_service import notify_import_complete
        doc_row = supabase.table("documents").select("title, user_id").eq("id", document_id).single().execute()
        if doc_row.data and doc_row.data.get("user_id"):
            notify_import_complete(
                doc_row.data["user_id"],
                doc_row.data.get("title", "Your document"),
                document_id,
            )
    except Exception as e:
        logger.warning("Import notification failed for document %s: %s", document_id, e)

    return {
        "status": "ready",
        "document_id": document_id,
        "pages_total": len(metadata_rows),
        "pages_native": len(metadata_rows) - len(pages_needing_vision),
        "pages_vision": len(pages_needing_vision),
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

        embed_res = genai.embed_content(
            model="models/text-embedding-004",
            content=chunks,
            task_type="retrieval_document",
        )

        rows = [
            {
                "book_id": chapter["book_id"],
                "chapter_id": chapter_id,
                "chunk_index": i,
                "content": c,
                "embedding": e,
            }
            for i, (c, e) in enumerate(zip(chunks, embed_res["embedding"]))
        ]
        supabase.table("chapter_embeddings").delete().eq("chapter_id", chapter_id).execute()
        supabase.table("chapter_embeddings").insert(rows).execute()
        supabase.table("book_chapters").update({"embedding_indexed": True}).eq("id", chapter_id).execute()
    except Exception as e:
        logger.error("Failed to index chapter %s: %s", chapter_id, e, exc_info=True)
