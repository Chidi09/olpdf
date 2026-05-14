import os

os.environ["SUPABASE_JWT_SECRET"] = "test-secret-for-testing-only"
os.environ["OLPDF_DEV_MODE"] = "true"

from fastapi.testclient import TestClient
from unittest.mock import patch

from apps.api.main import app
from apps.api.auth_utils import require_auth
from apps.api.core.auth import verify_jwt_token as real_verify


_MOCK_USER = {"sub": "test-user", "email": "test@example.com"}
app.dependency_overrides[require_auth] = lambda: _MOCK_USER

client = TestClient(app)


@patch("apps.api.routes.pdf.compress_pdf")
@patch("apps.api.routes.pdf.r2_storage")
@patch("apps.api.routes.pdf.DownloadLinkRepository")
@patch("apps.api.repositories.document_repo.DocumentRepository.get_by_id")
def test_toolkit_compress_downloads_document_and_uploads_result(mock_get, mock_link_repo, mock_r2, mock_compress):
    app.dependency_overrides.clear()
    app.dependency_overrides[require_auth] = lambda: _MOCK_USER
    mock_get.return_value = {
        "id": "doc-123",
        "user_id": "test-user",
        "document_model": {"blocks": []},
    }
    mock_r2.download_bytes.return_value = b"%PDF-1.7\noriginal"
    mock_compress.return_value = b"%PDF-1.7\ncompressed"
    mock_r2.upload_bytes.return_value = "https://storage.example/private/doc-123_compressed.pdf"
    mock_link_repo.create.return_value = {
        "slug": "abc12345",
        "object_key": "toolkit/doc-123_compressed.pdf",
        "filename": "doc-123_compressed.pdf",
        "content_type": "application/pdf",
        "url": "/d/abc12345",
    }

    response = client.post(
        "/api/pdf/compress?doc_id=doc-123",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    assert response.json()["url"] == "/d/abc12345"
    mock_r2.download_bytes.assert_called_once_with("documents/doc-123.pdf")
    mock_r2.upload_bytes.assert_called_once()
    mock_link_repo.create.assert_called_once()
