import os

os.environ["SUPABASE_JWT_SECRET"] = "test-secret-for-testing-only"
os.environ["OLPDF_DEV_MODE"] = "true"

from unittest.mock import patch
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.auth_utils import require_auth

_MOCK_USER = {"sub": "user-1", "email": "test@example.com"}
app.dependency_overrides[require_auth] = lambda: _MOCK_USER

client = TestClient(app)
AUTH_HEADERS = {"Authorization": "Bearer test-token"}


def test_export_accepts_layout_payload_without_blocks():
    """Imported PDF export with layout_payload should not return 422."""
    with (
        patch("apps.api.routes.documents.check_ownership") as mock_owner,
        patch("apps.api.routes.documents.r2_storage") as mock_r2,
        patch("apps.api.routes.documents.DownloadLinkRepository.create") as mock_link,
    ):
        mock_owner.return_value = {"id": "doc-1"}
        mock_r2.upload_bytes.return_value = "https://storage.example/export.pdf"
        mock_link.return_value = {
            "slug": "abc123",
            "url": "/d/abc123",
            "object_key": "exports/doc-1.fidelity",
            "filename": "doc.pdf",
            "content_type": "application/pdf",
        }

        response = client.post(
            "/api/documents/doc-1/export/fidelity",
            json={
                "document_model": {
                    "id": "doc-1",
                    "meta": {
                        "title": "PDF Doc",
                        "native_pdf": True,
                        "original_pdf_key": "documents/doc-1.pdf",
                    },
                    "blocks": [],
                    "page_dimensions": [],
                    "styles": {},
                },
                "font_metrics": {},
                "layout_payload": {
                    "source_kind": "imported_pdf",
                    "original_pdf_key": "documents/doc-1.pdf",
                    "pages": [
                        {
                            "index": 0,
                            "width": 612,
                            "height": 792,
                            "objects": [
                                {"id": "obj-1", "type": "text", "x": 72, "y": 100, "width": 400, "height": 30, "rotation": 0, "content": "Hello"},
                            ],
                        }
                    ],
                    "export_strategy": "preserve_original",
                },
                "original_object_key": "documents/doc-1.pdf",
                "operations": [],
            },
            headers=AUTH_HEADERS,
        )

        assert response.status_code == 200, f"Expected 200 got {response.status_code}: {response.text}"
        data = response.json()
        assert data["url"] == "/d/abc123"
