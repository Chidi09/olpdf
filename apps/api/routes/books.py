from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from ..models import BookModel, BookChapter
from ..repositories import DocumentRepository, BookRepository
from ..auth_utils import require_auth, check_ownership
from ..core.auth import ensure_profile_row
from ..security_utils import sanitize_string, sanitize_dict
from ..factories import BookExportFactory
from ..worker_utils import index_chapter_embeddings
from ..ai_utils import check_book_consistency as ai_check_consistency
from ..supabase_client import supabase
from ..storage_client import r2_storage
from ..core.supabase_client import supabase

router = APIRouter(prefix="/api/books", tags=["books"])

@router.get("")
async def list_books(user: dict = Depends(require_auth)) -> List[dict]:
    return BookRepository.list_for_user(user["sub"])

@router.post("/create")
async def create_book(book: BookModel, user: dict = Depends(require_auth)) -> dict:
    title = sanitize_string(book.title)
    meta = sanitize_dict(book.meta)
    # Ensure profile exists for schemas enforcing book/document user FK to profiles.
    # Handles both newer and legacy profile schemas.
    ensure_profile_row(user)
    res = BookRepository.create(title, meta, user_id=user["sub"])
    return {"id": res["id"], "status": "created"}

@router.get("/{book_id}")
async def get_book(book_id: str, user: dict = Depends(require_auth)) -> dict:
    book = check_ownership(book_id, user, resource_type="book")
    chapters = BookRepository.get_chapters(book_id)
    return {**book, "chapters": chapters}

@router.patch("/{book_id}/meta")
async def update_book_meta(book_id: str, meta_updates: dict, user: dict = Depends(require_auth)) -> dict:
    book = check_ownership(book_id, user, resource_type="book")
    current_meta = book.get("meta") or {}
    new_meta = {**current_meta, **meta_updates}
    BookRepository.update(book_id, {"meta": new_meta})
    return {"status": "success"}

@router.post("/{book_id}/consistency")
async def check_book_consistency(book_id: str, query: str, user: dict = Depends(require_auth)) -> dict:
    check_ownership(book_id, user, resource_type="book")
    return await ai_check_consistency(book_id, query)

@router.post("/{book_id}/chapters")
async def add_chapter(book_id: str, chapter: BookChapter, user: dict = Depends(require_auth)) -> dict:
    check_ownership(book_id, user, resource_type="book")
    
    title = sanitize_string(chapter.title)
    new_doc = DocumentRepository.create(
        title,
        {
            "id": chapter.document_id or "",
            "meta": {
                "title": title,
                "author": "",
                "page_size": "A4",
                "margins": {"top": 72, "bottom": 72, "left": 72, "right": 72},
                "export_standard": "pdf_a",
                "layout_mode": "editable",
            },
            "styles": {},
            "blocks": [],
            "page_dimensions": [],
        },
        status="ready",
        user_id=user["sub"],
    )
    new_ch = BookRepository.create_chapter(book_id, new_doc["id"], title, chapter.chapter_number)
    return {"id": new_ch["id"], "document_id": new_doc["id"]}

@router.put("/{book_id}/chapters/{chapter_id}")
async def update_chapter(book_id: str, chapter_id: str, chapter: BookChapter, background_tasks: BackgroundTasks, user: dict = Depends(require_auth)) -> dict:
    check_ownership(book_id, user, resource_type="book")
        
    ch_data = supabase.table("book_chapters").select("status").eq("id", chapter_id).single().execute()
    old_status = ch_data.data["status"]
    title = sanitize_string(chapter.title)
    BookRepository.update_chapter(chapter_id, {"title": title, "chapter_number": chapter.chapter_number, "status": chapter.status, "word_count": chapter.word_count})
    if old_status == "draft" and chapter.status == "review":
        background_tasks.add_task(index_chapter_embeddings, chapter_id)
    return {"status": "success"}

MATTER_KEYS = {"title_page", "copyright", "toc", "about_author"}
MATTER_TITLES = {"title_page": "Title Page", "copyright": "Copyright", "toc": "Table of Contents", "about_author": "About the Author"}

@router.post("/{book_id}/matter/{matter_key}")
async def ensure_book_matter(book_id: str, matter_key: str, user: dict = Depends(require_auth)) -> dict:
    if matter_key not in MATTER_KEYS:
        raise HTTPException(status_code=400, detail=f"Invalid matter key: {matter_key}")
    book = check_ownership(book_id, user, resource_type="book")
    current_matter = dict(book.get("meta", {}).get("matter", {}))
    existing = current_matter.get(matter_key)
    if existing and existing.get("document_id"):
        return {"document_id": existing["document_id"], "matter_key": matter_key, "created": False}
    title = MATTER_TITLES.get(matter_key, matter_key.replace("_", " ").title())
    new_doc = DocumentRepository.create(
        title,
        {"meta": {"title": title, "page_size": "A4", "layout_mode": "editable"}, "blocks": [], "styles": {}, "page_dimensions": []},
        status="ready",
        user_id=user["sub"],
    )
    current_matter[matter_key] = {"document_id": new_doc["id"], "title": title}
    BookRepository.update(book_id, {"meta": {**book.get("meta", {}), "matter": current_matter}})
    return {"document_id": new_doc["id"], "matter_key": matter_key, "created": True}

@router.post("/{book_id}/export/{format_type}")
async def export_book(book_id: str, format_type: str, user: dict = Depends(require_auth)) -> dict:
    book_data = check_ownership(book_id, user, resource_type="book")
        
    ch_list = BookRepository.get_chapters(book_id)
    chapters = []
    for ch in ch_list:
        doc = DocumentRepository.get_by_id(ch["document_id"])
        chapters.append({**ch, "document_model": doc["document_model"]})
    engine = BookExportFactory.get_engine(format_type)
    data_bytes = engine(book_data, chapters)
    
    # Upload to storage
    object_name = f"exports/book-{book_id}.{format_type}"
    url = r2_storage.upload_bytes(data_bytes, object_name)
    
    return {"url": url, "status": "ready", "size": len(data_bytes)}
