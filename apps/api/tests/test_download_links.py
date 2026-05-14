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


def test_create_download_link_returns_short_slug():
    with (
        patch("apps.api.main.verify_jwt_token") as mock_jwt,
        patch("apps.api.routes.downloads.DownloadLinkRepository.create") as mock_create,
    ):
        mock_jwt.return_value = {"sub": "user-1"}
        mock_create.return_value = {
            "slug": "abc12345",
            "object_key": "exports/doc-1.pdf",
            "filename": "doc.pdf",
            "content_type": "application/pdf",
            "url": "/d/abc12345",
        }

        response = client.post(
            "/api/downloads",
            json={
                "object_key": "exports/doc-1.pdf",
                "filename": "doc.pdf",
                "content_type": "application/pdf",
            },
            headers=AUTH_HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["url"] == "/d/abc12345"
        mock_create.assert_called_once()


def test_resolve_download_link_returns_signed_url():
    with (
        patch("apps.api.main.verify_jwt_token") as mock_jwt,
        patch("apps.api.routes.downloads.DownloadLinkRepository.get_by_slug") as mock_get,
        patch("apps.api.routes.downloads.r2_storage") as mock_r2,
    ):
        mock_jwt.return_value = {"sub": "user-1"}
        mock_get.return_value = {
            "slug": "abc12345",
            "object_key": "exports/doc-1.pdf",
            "filename": "doc.pdf",
            "content_type": "application/pdf",
            "created_at": "2026-05-14T12:00:00Z",
        }
        mock_r2.generate_presigned_url.return_value = "https://signed-r2.example/exports/doc-1.pdf?X-Amz-Signature=abc"

        response = client.get("/api/downloads/abc12345", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == "abc12345"
        assert data["url"] == "https://signed-r2.example/exports/doc-1.pdf?X-Amz-Signature=abc"
        assert data["filename"] == "doc.pdf"


def test_resolve_download_link_missing_returns_404():
    with (
        patch("apps.api.main.verify_jwt_token") as mock_jwt,
        patch("apps.api.routes.downloads.DownloadLinkRepository.get_by_slug") as mock_get,
    ):
        mock_jwt.return_value = {"sub": "user-1"}
        mock_get.return_value = None

        response = client.get("/api/downloads/nonexistent", headers=AUTH_HEADERS)

        assert response.status_code == 404
