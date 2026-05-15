"""Build immutable publication snapshots from live source records."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional


def build_document_publication_snapshot(
    doc_record: Dict[str, Any],
    layout_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build an immutable snapshot from a document record.

    The snapshot captures the source state at publish time so the public
    reader never references live document data.
    """
    model = doc_record.get("document_model") or {}
    meta = model.get("meta") or {}
    blocks = model.get("blocks") or []
    page_dimensions = model.get("page_dimensions") or []

    snapshot: Dict[str, Any] = {
        "schema_version": 1,
        "source_type": "document",
        "title": meta.get("title", "Untitled"),
        "document_model": {
            "meta": {
                "title": meta.get("title", ""),
                "author": meta.get("author", ""),
                "description": meta.get("description", ""),
            },
            "blocks": blocks,
            "page_dimensions": page_dimensions,
        },
        "published_at": datetime.now(timezone.utc).isoformat(),
    }

    if layout_payload:
        snapshot["layout"] = layout_payload
        snapshot["document_model"]["meta"]["original_pdf_key"] = layout_payload.get("original_pdf_key")

    return snapshot


def build_pdf_publication_snapshot(
    doc_record: Dict[str, Any],
    layout_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build an immutable snapshot for an imported PDF document."""
    return build_document_publication_snapshot(doc_record, layout_payload=layout_payload)
