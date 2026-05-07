"""
Higher-level storage operations — wraps R2 with olpdf-specific path conventions.
"""
import uuid
from typing import Optional

from ..core.storage_client import r2_storage


def upload_document_pdf(user_id: str, doc_id: str, pdf_bytes: bytes) -> Optional[str]:
    object_name = f"documents/{user_id}/{doc_id}/original.pdf"
    return r2_storage.upload_bytes(pdf_bytes, object_name)


def upload_export(doc_id: str, format_type: str, data: bytes) -> Optional[str]:
    ext = "epub" if format_type == "epub" else "pdf"
    object_name = f"exports/{doc_id}/{uuid.uuid4().hex}.{ext}"
    url = r2_storage.upload_bytes(data, object_name)
    if url:
        return r2_storage.generate_presigned_url(object_name, expiration=86400)
    return None


def get_presigned_url(object_name: str, expiration: int = 3600) -> Optional[str]:
    return r2_storage.generate_presigned_url(object_name, expiration)
