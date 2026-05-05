from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from ..models import BookModel, BookChapter
from ..repositories import DocumentRepository, BookRepository
from ..auth_utils import require_auth
from ..factories import BookExportFactory
from ..worker_utils import index_chapter_embeddings
from ..ai_utils import check_book_consistency as ai_check_consistency
from ..supabase_client import supabase
from ..storage_client import r2_storage

router = APIRouter(prefix="/api/books", tags=["books"])

@router.post("/create")
async def create_book(book: BookModel, user: dict = Depends(require_auth)) -> dict:
    res = BookRepository.create(book.title, book.meta, user_id=user["sub"])
    return {"id": res["id"], "status": "created"}

@router.get("/{book_id}")
async def get_book(book_id: str, user: dict = Depends(require_auth)) -> dict:
    book = BookRepository.get_by_id(book_id)
    if not book: raise HTTPException(status_code=404, detail="Book not found")
    if book.get("user_id") and str(book["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")
    chapters = BookRepository.get_chapters(book_id)
    return {**book, "chapters": chapters}

@router.post("/{book_id}/consistency")
async def check_book_consistency(book_id: str, query: str, user: dict = Depends(require_auth)) -> dict:
    book = BookRepository.get_by_id(book_id)
    if not book: raise HTTPException(status_code=404, detail="Book not found")
    if book.get("user_id") and str(book["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")
        
    return await ai_check_consistency(book_id, query)

@router.post("/{book_id}/chapters")
async def add_chapter(book_id: str, chapter: BookChapter, user: dict = Depends(require_auth)) -> dict:
    book = BookRepository.get_by_id(book_id)
    if book and book.get("user_id") and str(book["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")
        
    new_doc = DocumentRepository.create(chapter.title, {"blocks": [], "meta": {"user_id": user["sub"]}}, "ready")
    new_ch = BookRepository.create_chapter(book_id, new_doc["id"], chapter.title, chapter.chapter_number)
    return {"id": new_ch["id"], "document_id": new_doc["id"]}

@router.put("/{book_id}/chapters/{chapter_id}")
async def update_chapter(book_id: str, chapter_id: str, chapter: BookChapter, background_tasks: BackgroundTasks, user: dict = Depends(require_auth)) -> dict:
    book = BookRepository.get_by_id(book_id)
    if book and book.get("user_id") and str(book["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")
        
    ch_data = supabase.table("book_chapters").select("status").eq("id", chapter_id).single().execute()
    old_status = ch_data.data["status"]
    BookRepository.update_chapter(chapter_id, {"title": chapter.title, "chapter_number": chapter.chapter_number, "status": chapter.status, "word_count": chapter.word_count})
    if old_status == "draft" and chapter.status == "review":
        background_tasks.add_task(index_chapter_embeddings, chapter_id)
    return {"status": "success"}

@router.post("/{book_id}/export/{format_type}")
async def export_book(book_id: str, format_type: str, user: dict = Depends(require_auth)) -> dict:
    book_data = BookRepository.get_by_id(book_id)
    if book_data and book_data.get("user_id") and str(book_data["user_id"]) != user["sub"] and user["sub"] != "dev-user":
        raise HTTPException(status_code=403, detail="Forbidden")
        
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
