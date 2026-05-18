import io
import uuid
import zipfile
from typing import Any, Dict, List

import fitz
from fastapi import APIRouter, Depends, HTTPException, Request
from ..models import (
    PdfRedactionPayload,
    PdfMergePayload,
    PdfSplitPayload,
    PdfRotatePayload,
    PdfWatermarkPayload,
    PdfProtectPayload,
    PdfPageRange,
    PdfPageNumberPayload,
    PdfHeaderFooterPayload,
    PdfMetadataPayload,
    PdfBackgroundPayload,
    PdfStampPayload,
    PdfReplaceTextPayload,
    PdfBatesPayload,
    PdfCropPayload,
    PdfExtractPagesPayload,
    PdfDeletePagesPayload,
    PdfReorderPayload,
    PdfScalePayload,
    PdfMarginsPayload,
    PdfResizePayload,
    PdfSplitSizePayload,
    PdfNUpPayload,
    PdfInitialViewPayload,
    PdfRemovePasswordPayload,
    PdfRedactTextPayload,
    PdfComparePayload,
    PdfSignPayload,
    PdfToImagesPayload,
)
from ..auth_utils import require_auth
from ..core.auth import check_ownership as check_document_ownership, require_scopes
from ..export_utils import (
    apply_true_redaction,
    detect_form_fields,
    fill_form_fields,
    merge_pdfs,
    split_pdf,
    compress_pdf,
    rotate_pages,
    add_watermark,
    protect_pdf,
    extract_images_from_pdf,
)
from ..core.storage_client import r2_storage
from ..repositories import DocumentRepository
from ..repositories import AuditLogRepository
from ..repositories.download_link_repo import DownloadLinkRepository

# Import limiter from limiter module
from ..limiter import limiter

router = APIRouter(prefix="/api/pdf", tags=["pdf"])

# ... helpers ...

def _check_ownership(doc_id: str, user: dict) -> dict:
    return check_document_ownership(doc_id, user)


def _download_pdf_from_storage(doc_id: str) -> bytes:
    object_name = f"documents/{doc_id}.pdf"
    pdf_bytes = r2_storage.download_bytes(object_name)
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Original PDF not found. Upload or import a PDF before running toolkit operations.")
    return pdf_bytes


def _upload_result(data: bytes, file_name: str, user: dict | None = None) -> str:
    object_name = f"toolkit/{file_name}"
    uploaded = r2_storage.upload_bytes(data, object_name)
    if not uploaded:
        raise HTTPException(status_code=500, detail="Failed to upload toolkit result")
    if user:
        link = DownloadLinkRepository.create(
            owner_id=user.get("sub", "unknown"),
            object_key=object_name,
            filename=file_name,
            content_type="application/pdf",
        )
        return link["url"]
    signed_url = r2_storage.generate_presigned_url(object_name, expiration=86400)
    if not signed_url:
        raise HTTPException(status_code=500, detail="Failed to generate toolkit download URL")
    return signed_url

@router.post("/redact")
@limiter.limit("5/minute")
async def pdf_redact(request: Request, doc_id: str, payload: PdfRedactionPayload, user: dict = Depends(require_auth)) -> dict:
    await require_scopes(["documents:write"])(user)
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    result = apply_true_redaction(pdf_bytes, payload.areas)
    url = _upload_result(result, f"{doc_id}_redacted.pdf", user=user)
    AuditLogRepository.create(
        user_id=user["sub"],
        resource_id=doc_id,
        resource_type="document",
        action="redacted",
        metadata={"area_count": len(payload.areas)},
        ip_address=request.client.host if request.client else "unknown",
    )
    return {"url": url, "status": "success"}


@router.post("/forms-detect")
@limiter.limit("10/minute")
async def pdf_form_detect(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> List[dict]:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    return detect_form_fields(pdf_bytes)


from ..security_utils import sanitize_string, sanitize_dict

@router.post("/forms-fill")
@limiter.limit("10/minute")
async def pdf_form_fill(request: Request, doc_id: str, payload: Dict[str, str], user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    # Sanitize dictionary
    safe_payload = sanitize_dict(payload)
    filled = fill_form_fields(pdf_bytes, safe_payload)
    url = _upload_result(filled, f"{doc_id}_filled.pdf", user=user)
    return {"url": url, "status": "success"}


# --- New toolkit operations ---

@router.post("/merge")
@limiter.limit("5/minute")
async def pdf_merge(request: Request, payload: PdfMergePayload, user: dict = Depends(require_auth)) -> dict:
    """Merge multiple documents into one PDF."""
    if len(payload.doc_ids) < 2:
        raise HTTPException(status_code=422, detail="At least 2 doc_ids required for merge")
    pdf_bytes_list: List[bytes] = []
    for doc_id in payload.doc_ids:
        _check_ownership(doc_id, user)
        pdf_bytes_list.append(_download_pdf_from_storage(doc_id))
    merged = merge_pdfs(pdf_bytes_list)
    out_name = f"merged_{uuid.uuid4().hex[:8]}.pdf"
    url = _upload_result(merged, out_name, user=user)
    return {"url": url, "status": "success", "page_count": len(payload.doc_ids)}


@router.post("/split")
@limiter.limit("5/minute")
async def pdf_split(request: Request, doc_id: str, payload: PdfSplitPayload, user: dict = Depends(require_auth)) -> dict:
    """Split a document into multiple PDFs by page ranges."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    ranges = [{"start": r.start, "end": r.end} for r in payload.page_ranges]
    parts = split_pdf(pdf_bytes, ranges)
    urls: List[str] = []
    for i, part_bytes in enumerate(parts):
        url = _upload_result(part_bytes, f"{doc_id}_part{i + 1}.pdf", user=user)
        urls.append(url)
    return {"urls": urls, "status": "success", "parts": len(urls)}


@router.post("/compress")
@limiter.limit("5/minute")
async def pdf_compress(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    """Compress a PDF to reduce file size."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    original_size = len(pdf_bytes)
    compressed = compress_pdf(pdf_bytes)
    url = _upload_result(compressed, f"{doc_id}_compressed.pdf", user=user)
    return {
        "url": url,
        "status": "success",
        "original_bytes": original_size,
        "compressed_bytes": len(compressed),
        "savings_pct": round((1 - len(compressed) / original_size) * 100, 1),
    }


@router.post("/rotate")
@limiter.limit("10/minute")
async def pdf_rotate(request: Request, doc_id: str, payload: PdfRotatePayload, user: dict = Depends(require_auth)) -> dict:
    """Rotate pages in a PDF."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    rotated = rotate_pages(pdf_bytes, payload.rotation, payload.page_indices)
    url = _upload_result(rotated, f"{doc_id}_rotated.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/watermark")
@limiter.limit("10/minute")
async def pdf_watermark(request: Request, doc_id: str, payload: PdfWatermarkPayload, user: dict = Depends(require_auth)) -> dict:
    """Add a diagonal text watermark to every page."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    safe_text = sanitize_string(payload.text)
    watermarked = add_watermark(pdf_bytes, safe_text, payload.opacity)
    url = _upload_result(watermarked, f"{doc_id}_watermarked.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/protect")
@limiter.limit("10/minute")
async def pdf_protect(request: Request, doc_id: str, payload: PdfProtectPayload, user: dict = Depends(require_auth)) -> dict:
    """Password-protect a PDF with AES-256 encryption."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    protected = protect_pdf(pdf_bytes, payload.user_password, payload.owner_password)
    url = _upload_result(protected, f"{doc_id}_protected.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/extract-images")
@limiter.limit("5/minute")
async def pdf_extract_images(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    """Extract all embedded images from a PDF. Returns base64-encoded image data."""
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    images = extract_images_from_pdf(pdf_bytes)
    return {"images": images, "count": len(images), "status": "success"}


# === FORMAT CONVERSION STUBS (501 — external tools required) ===

@router.post("/pdf-to-docx")
@limiter.limit("5/minute")
async def pdf_to_docx(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="PDF to DOCX conversion not yet available. Coming soon.")


@router.post("/pdf-to-html")
@limiter.limit("5/minute")
async def pdf_to_html(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="PDF to HTML conversion not yet available. Coming soon.")


@router.post("/pdf-to-epub")
@limiter.limit("5/minute")
async def pdf_to_epub(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="PDF to EPUB conversion not yet available. Coming soon.")


@router.post("/pdf-to-markdown")
@limiter.limit("5/minute")
async def pdf_to_markdown(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="PDF to Markdown conversion not yet available. Coming soon.")


@router.post("/pdf-to-excel")
@limiter.limit("5/minute")
async def pdf_to_excel(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="PDF to Excel conversion not yet available. Coming soon.")


@router.post("/pdf-to-powerpoint")
@limiter.limit("5/minute")
async def pdf_to_powerpoint(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="PDF to PowerPoint conversion not yet available. Coming soon.")


# === BODYLESS OPERATIONS (501 — not yet implementable with fitz) ===

@router.post("/booklet-printing")
@limiter.limit("5/minute")
async def pdf_booklet_printing(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Booklet printing not yet available. Coming soon.")


@router.post("/deskew")
@limiter.limit("10/minute")
async def pdf_deskew(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Deskew not yet available. Coming soon.")


@router.post("/ocr")
@limiter.limit("5/minute")
async def pdf_ocr(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="OCR support is handled by a separate worker service. Coming soon.")


@router.post("/pdfa-conversion")
@limiter.limit("5/minute")
async def pdf_pdfa_conversion(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="PDF/A conversion not yet available. Coming soon.")


@router.post("/remove-margins")
@limiter.limit("10/minute")
async def pdf_remove_margins(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Remove margins not yet available. Coming soon.")


@router.post("/replace-images")
@limiter.limit("5/minute")
async def pdf_replace_images(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Replace images not yet available. Coming soon.")


@router.post("/split-by-bookmarks")
@limiter.limit("5/minute")
async def pdf_split_by_bookmarks(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Split by bookmarks not yet available. Coming soon.")


@router.post("/validate-pdfa")
@limiter.limit("5/minute")
async def pdf_validate_pdfa(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="PDF/A validation not yet available. Coming soon.")


@router.post("/verify-signature")
@limiter.limit("5/minute")
async def pdf_verify_signature(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Signature verification not yet available. Coming soon.")


# === BODYLESS OPERATIONS (implemented with PyMuPDF) ===

@router.post("/cleanup")
@limiter.limit("10/minute")
async def pdf_cleanup(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    result = doc.write(garbage=4, deflate=True)
    doc.close()
    url = _upload_result(result, f"{doc_id}_cleaned.pdf", user=user)
    return {"url": url, "status": "success", "original_bytes": len(pdf_bytes), "result_bytes": len(result)}


@router.post("/create-bookmarks")
@limiter.limit("10/minute")
async def pdf_create_bookmarks(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    toc = [[1, f"Page {i+1}", i + 1] for i in range(len(doc))]
    doc.set_toc(toc)
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_bookmarked.pdf", user=user)
    return {"url": url, "status": "success", "bookmark_count": len(toc)}


@router.post("/embed-fonts")
@limiter.limit("10/minute")
async def pdf_embed_fonts(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    doc.subset_fonts()
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_embedded.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/extract-attachments")
@limiter.limit("10/minute")
async def pdf_extract_attachments(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    names = doc.embfile_names()
    attachments = {}
    for name in names:
        data = doc.embfile_get(name)
        attachments[name] = data.hex()
    doc.close()
    return {"attachments": attachments, "count": len(names), "status": "success"}


@router.post("/extract-fonts")
@limiter.limit("10/minute")
async def pdf_extract_fonts(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    fonts = []
    seen = set()
    for page_num, page in enumerate(doc):
        for f in page.get_fonts():
            key = (f[0], f[1], f[3])
            if key not in seen:
                seen.add(key)
                fonts.append({
                    "name": f[0],
                    "type": f[1],
                    "encoding": f[2],
                    "embedded": f[3],
                    "page": page_num + 1,
                })
    doc.close()
    return {"fonts": fonts, "count": len(fonts), "status": "success"}


@router.post("/extract-form-data")
@limiter.limit("10/minute")
async def pdf_extract_form_data(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    form_data = []
    for page_num, page in enumerate(doc):
        for widget in page.widgets():
            form_data.append({
                "page": page_num + 1,
                "field_name": widget.field_name,
                "field_value": widget.field_value,
                "field_type": widget.field_type,
            })
    doc.close()
    return {"form_data": form_data, "count": len(form_data), "status": "success"}


@router.post("/extract-links")
@limiter.limit("10/minute")
async def pdf_extract_links(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    links = []
    for page_num, page in enumerate(doc):
        for link in page.get_links():
            links.append({"page": page_num + 1, **link})
    doc.close()
    return {"links": links, "count": len(links), "status": "success"}


@router.post("/extract-tables")
@limiter.limit("10/minute")
async def pdf_extract_tables(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    tables = []
    for page_num, page in enumerate(doc):
        try:
            tabs = page.find_tables()
            for tab in tabs:
                tables.append({
                    "page": page_num + 1,
                    "rows": tab.row_count,
                    "cols": tab.col_count,
                    "data": tab.extract(),
                })
        except Exception:
            pass
    doc.close()
    return {"tables": tables, "count": len(tables), "status": "success"}


@router.post("/extract-text")
@limiter.limit("10/minute")
async def pdf_extract_text(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return {"text": text, "characters": len(text), "status": "success"}


@router.post("/flatten-forms")
@limiter.limit("10/minute")
async def pdf_flatten_forms(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        for widget in page.widgets():
            try:
                widget.update()
            except Exception:
                pass
    doc.need_appearances = True
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_flattened.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/grayscale")
@limiter.limit("10/minute")
async def pdf_grayscale(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        page.set_colorspace(fitz.csGRAY)
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_grayscale.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/invert-colors")
@limiter.limit("10/minute")
async def pdf_invert_colors(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        pix = page.get_pixmap()
        pix.invert()
        page.clean_contents()
        page.insert_image(page.rect, pixmap=pix)
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_inverted.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/linearize")
@limiter.limit("10/minute")
async def pdf_linearize(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    buf = io.BytesIO()
    doc.save(buf, linearize=True)
    result = buf.getvalue()
    doc.close()
    url = _upload_result(result, f"{doc_id}_linearized.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/measure-dimensions")
@limiter.limit("10/minute")
async def pdf_measure_dimensions(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page_num, page in enumerate(doc):
        r = page.rect
        pages.append({
            "page": page_num + 1,
            "width": r.width,
            "height": r.height,
            "width_inches": round(r.width / 72, 2),
            "height_inches": round(r.height / 72, 2),
        })
    doc.close()
    return {"pages": pages, "page_count": len(pages), "status": "success"}


@router.post("/print-to-pdf")
@limiter.limit("10/minute")
async def pdf_print_to_pdf(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_print.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/remove-annotations")
@limiter.limit("10/minute")
async def pdf_remove_annotations(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    removed = 0
    for page in doc:
        annots = list(page.annots())
        for annot in annots:
            page.delete_annot(annot)
            removed += 1
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_no_annotations.pdf", user=user)
    return {"url": url, "status": "success", "annotations_removed": removed}


@router.post("/remove-blank-pages")
@limiter.limit("10/minute")
async def pdf_remove_blank_pages(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total = len(doc)
    to_keep = []
    for i, page in enumerate(doc):
        text = page.get_text("text").strip()
        images = page.get_images()
        if text or images:
            to_keep.append(i)
    doc.select(to_keep)
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_no_blanks.pdf", user=user)
    return {"url": url, "status": "success", "original_pages": total, "removed": total - len(to_keep), "remaining": len(to_keep)}


@router.post("/remove-bookmarks")
@limiter.limit("10/minute")
async def pdf_remove_bookmarks(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    doc.set_toc([])
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_no_bookmarks.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/remove-javascript")
@limiter.limit("10/minute")
async def pdf_remove_javascript(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        doc.del_js()
    except AttributeError:
        pass
    for page in doc:
        try:
            page.del_js()
        except AttributeError:
            pass
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_no_js.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/remove-metadata")
@limiter.limit("10/minute")
async def pdf_remove_metadata(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    doc.metadata = {"title": "", "author": "", "subject": "", "keywords": ""}
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_no_meta.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/repair")
@limiter.limit("10/minute")
async def pdf_repair(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    result = doc.write(garbage=4, deflate=True)
    doc.close()
    url = _upload_result(result, f"{doc_id}_repaired.pdf", user=user)
    return {"url": url, "status": "success", "original_bytes": len(pdf_bytes), "result_bytes": len(result)}


@router.post("/reverse-pages")
@limiter.limit("10/minute")
async def pdf_reverse_pages(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    n = len(doc)
    doc.select(list(range(n - 1, -1, -1)))
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_reversed.pdf", user=user)
    return {"url": url, "status": "success", "page_count": n}


@router.post("/unembed-fonts")
@limiter.limit("10/minute")
async def pdf_unembed_fonts(request: Request, doc_id: str, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_unembedded.pdf", user=user)
    return {"url": url, "status": "success"}


# === PAYLOAD OPERATIONS (501 — not yet implementable with fitz) ===

@router.post("/add-background")
@limiter.limit("10/minute")
async def pdf_add_background(request: Request, doc_id: str, payload: PdfBackgroundPayload, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Add background not yet available. Coming soon.")


@router.post("/add-margins")
@limiter.limit("10/minute")
async def pdf_add_margins(request: Request, doc_id: str, payload: PdfMarginsPayload, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Add margins not yet available. Coming soon.")


@router.post("/add-stamp")
@limiter.limit("10/minute")
async def pdf_add_stamp(request: Request, doc_id: str, payload: PdfStampPayload, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Add stamp not yet available. Coming soon.")


@router.post("/compare-pdfs")
@limiter.limit("5/minute")
async def pdf_compare_pdfs(request: Request, doc_id: str, payload: PdfComparePayload, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="PDF comparison not yet available. Coming soon.")


@router.post("/n-up")
@limiter.limit("5/minute")
async def pdf_n_up(request: Request, doc_id: str, payload: PdfNUpPayload, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="N-up layout not yet available. Coming soon.")


@router.post("/remove-passwords")
@limiter.limit("5/minute")
async def pdf_remove_passwords(request: Request, doc_id: str, payload: PdfRemovePasswordPayload, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Remove passwords not yet available. Coming soon.")


@router.post("/resize-pdf")
@limiter.limit("10/minute")
async def pdf_resize_pdf(request: Request, doc_id: str, payload: PdfResizePayload, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Resize PDF not yet available. Coming soon.")


@router.post("/scale-pages")
@limiter.limit("10/minute")
async def pdf_scale_pages(request: Request, doc_id: str, payload: PdfScalePayload, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Scale pages not yet available. Coming soon.")


@router.post("/set-initial-view")
@limiter.limit("10/minute")
async def pdf_set_initial_view(request: Request, doc_id: str, payload: PdfInitialViewPayload, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Set initial view not yet available. Coming soon.")


@router.post("/sign-pdf")
@limiter.limit("5/minute")
async def pdf_sign_pdf(request: Request, doc_id: str, payload: PdfSignPayload, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Digital signing not yet available. Coming soon.")


@router.post("/split-by-size")
@limiter.limit("5/minute")
async def pdf_split_by_size(request: Request, doc_id: str, payload: PdfSplitSizePayload, user: dict = Depends(require_auth)) -> dict:
    raise HTTPException(status_code=501, detail="Split by size not yet available. Coming soon.")


# === PAYLOAD OPERATIONS (implemented with PyMuPDF) ===

@router.post("/add-footer")
@limiter.limit("10/minute")
async def pdf_add_footer(request: Request, doc_id: str, payload: PdfHeaderFooterPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        r = page.rect
        page.insert_text(fitz.Point(r.width / 2, r.height - 20), payload.text, fontsize=10, color=(0.5, 0.5, 0.5))
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_footer.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/add-header")
@limiter.limit("10/minute")
async def pdf_add_header(request: Request, doc_id: str, payload: PdfHeaderFooterPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        r = page.rect
        page.insert_text(fitz.Point(r.width / 2, 20), payload.text, fontsize=10, color=(0.5, 0.5, 0.5))
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_header.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/add-page-numbers")
@limiter.limit("10/minute")
async def pdf_add_page_numbers(request: Request, doc_id: str, payload: PdfPageNumberPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    vert, horiz = payload.position.split("_")
    for i, page in enumerate(doc):
        text = payload.text.replace("{n}", str(payload.start_number + i))
        r = page.rect
        y = r.height - 20 if vert == "bottom" else 20
        x = r.width / 2 if horiz == "center" else (20 if horiz == "left" else r.width - 20)
        page.insert_text(fitz.Point(x, y), text, fontsize=10, color=(0, 0, 0))
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_numbered.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/bates-numbering")
@limiter.limit("10/minute")
async def pdf_bates_numbering(request: Request, doc_id: str, payload: PdfBatesPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for i, page in enumerate(doc):
        r = page.rect
        text = f"{payload.prefix} {payload.start_number + i}"
        page.insert_text(fitz.Point(r.width / 2, r.height - 20), text, fontsize=8, color=(0, 0, 0))
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_bates.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/crop-pages")
@limiter.limit("10/minute")
async def pdf_crop_pages(request: Request, doc_id: str, payload: PdfCropPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_to_crop = payload.page_indices if payload.page_indices else list(range(len(doc)))
    for idx in pages_to_crop:
        if idx < len(doc):
            doc[idx].set_cropbox(fitz.Rect(payload.x1, payload.y1, payload.x2, payload.y2))
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_cropped.pdf", user=user)
    return {"url": url, "status": "success"}


@router.post("/delete-pages")
@limiter.limit("10/minute")
async def pdf_delete_pages(request: Request, doc_id: str, payload: PdfDeletePagesPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    delete_set = set(payload.page_indices)
    to_keep = [i for i in range(len(doc)) if i not in delete_set]
    doc.select(to_keep)
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_trimmed.pdf", user=user)
    return {"url": url, "status": "success", "page_count": len(to_keep)}


@router.post("/extract-pages")
@limiter.limit("10/minute")
async def pdf_extract_pages(request: Request, doc_id: str, payload: PdfExtractPagesPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_indices = set()
    for r in payload.page_ranges:
        for i in range(r.start, min(r.end + 1, len(doc))):
            page_indices.add(i)
    sorted_indices = sorted(page_indices)
    new_doc = fitz.open()
    for idx in sorted_indices:
        new_doc.insert_pdf(doc, from_page=idx, to_page=idx)
    result = new_doc.write()
    new_doc.close()
    doc.close()
    url = _upload_result(result, f"{doc_id}_extracted.pdf", user=user)
    return {"url": url, "status": "success", "page_count": len(sorted_indices)}


@router.post("/pdf-to-images")
@limiter.limit("5/minute")
async def pdf_pdf_to_images(request: Request, doc_id: str, payload: PdfToImagesPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    zoom = payload.dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    ext = payload.format
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, page in enumerate(doc):
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes(ext)
            zf.writestr(f"page_{i+1:04d}.{ext}", img_bytes)
    doc.close()
    url = _upload_result(buf.getvalue(), f"{doc_id}_images.zip", user=user)
    return {"url": url, "status": "success", "page_count": len(doc)}


@router.post("/redact-text")
@limiter.limit("10/minute")
async def pdf_redact_text(request: Request, doc_id: str, payload: PdfRedactTextPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    matches_found = 0
    for page in doc:
        areas = page.search_for(payload.pattern)
        for area in areas:
            page.add_redact_annot(area, text=payload.replacement)
            matches_found += 1
        page.apply_redactions()
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_text_redacted.pdf", user=user)
    return {"url": url, "status": "success", "matches_found": matches_found}


@router.post("/reorder-pages")
@limiter.limit("10/minute")
async def pdf_reorder_pages(request: Request, doc_id: str, payload: PdfReorderPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    doc.select(payload.new_order)
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_reordered.pdf", user=user)
    return {"url": url, "status": "success", "page_count": len(payload.new_order)}


@router.post("/replace-text")
@limiter.limit("10/minute")
async def pdf_replace_text(request: Request, doc_id: str, payload: PdfReplaceTextPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    matches_found = 0
    for page in doc:
        areas = page.search_for(payload.find_text)
        for area in areas:
            page.add_redact_annot(area, text=payload.replace_text if payload.replace_text else None)
            matches_found += 1
        page.apply_redactions()
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_replaced.pdf", user=user)
    return {"url": url, "status": "success", "matches_found": matches_found}


@router.post("/set-metadata")
@limiter.limit("10/minute")
async def pdf_set_metadata(request: Request, doc_id: str, payload: PdfMetadataPayload, user: dict = Depends(require_auth)) -> dict:
    _check_ownership(doc_id, user)
    pdf_bytes = _download_pdf_from_storage(doc_id)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    meta = dict(doc.metadata) if doc.metadata else {}
    if payload.title is not None:
        meta["title"] = payload.title
    if payload.author is not None:
        meta["author"] = payload.author
    if payload.subject is not None:
        meta["subject"] = payload.subject
    if payload.keywords is not None:
        meta["keywords"] = payload.keywords
    doc.metadata = meta
    result = doc.write()
    doc.close()
    url = _upload_result(result, f"{doc_id}_metadata.pdf", user=user)
    return {"url": url, "status": "success"}
