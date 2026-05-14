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


def test_export_returns_branded_url():
    with (
        patch("apps.api.routes.documents.r2_storage") as mock_r2,
        patch("apps.api.routes.documents.DownloadLinkRepository.create") as mock_link,
        patch("apps.api.routes.documents.check_ownership") as mock_owner,
    ):
        mock_owner.return_value = {"id": "doc-1"}
        mock_r2.upload_bytes.return_value = "https://storage.example/exports/doc-1.fidelity"
        mock_link.return_value = {
            "slug": "abc12345",
            "object_key": "exports/doc-1.fidelity",
            "filename": "Test Doc.pdf",
            "content_type": "application/pdf",
            "url": "/d/abc12345",
        }

        response = client.post(
            "/api/documents/doc-1/export/fidelity",
            json={
                "document_model": {
                    "id": "doc-1",
                    "meta": {"title": "Test Doc", "layout_mode": "fidelity", "color_space": "rgb"},
                    "blocks": [
                        {"id": "blk_1", "type": "paragraph", "content": "Hello", "bounding_box": [72, 72, 120, 90]}
                    ],
                    "page_dimensions": [{"page_index": 0, "width": 612, "height": 792}],
                    "styles": {},
                },
                "font_metrics": {},
            },
            headers=AUTH_HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["url"] == "/d/abc12345"
        assert "storage.example" not in data["url"]
        mock_r2.upload_bytes.assert_called_once()
        mock_link.assert_called_once()


def test_export_fails_when_upload_fails():
    with (
        patch("apps.api.routes.documents.r2_storage") as mock_r2,
        patch("apps.api.routes.documents.check_ownership") as mock_owner,
    ):
        mock_owner.return_value = {"id": "doc-1"}
        mock_r2.upload_bytes.return_value = None

        response = client.post(
            "/api/documents/doc-1/export/fidelity",
            json={
                "document_model": {
                    "id": "doc-1",
                    "meta": {"title": "Test", "layout_mode": "fidelity", "color_space": "rgb"},
                    "blocks": [],
                    "page_dimensions": [],
                    "styles": {},
                },
                "font_metrics": {},
            },
            headers=AUTH_HEADERS,
        )

        assert response.status_code == 500
