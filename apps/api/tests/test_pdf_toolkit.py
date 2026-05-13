from fastapi.testclient import TestClient
from unittest.mock import patch

from apps.api.main import app
from apps.api.auth_utils import require_auth
from apps.api.core.auth import verify_jwt_token as real_verify


_MOCK_USER = {"sub": "test-user", "email": "test@example.com"}
app.dependency_overrides[require_auth] = lambda: _MOCK_USER

client = TestClient(app)


@patch("apps.api.main.verify_jwt_token", return_value=_MOCK_USER)
@patch("apps.api.routes.pdf.compress_pdf")
@patch("apps.api.routes.pdf.r2_storage")
@patch("apps.api.repositories.document_repo.DocumentRepository.get_by_id")
def test_toolkit_compress_downloads_document_and_uploads_result(mock_get, mock_r2, mock_compress, mock_jwt):
    mock_get.return_value = {
        "id": "doc-123",
        "user_id": "test-user",
        "document_model": {"blocks": []},
    }
    mock_r2.download_bytes.return_value = b"%PDF-1.7\noriginal"
    mock_compress.return_value = b"%PDF-1.7\ncompressed"
    mock_r2.upload_bytes.return_value = "https://storage.example/private/doc-123_compressed.pdf"
    mock_r2.generate_presigned_url.return_value = "https://storage.example/signed/doc-123_compressed.pdf"

    response = client.post(
        "/api/pdf/compress?doc_id=doc-123",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    assert response.json()["url"] == "https://storage.example/signed/doc-123_compressed.pdf"
    mock_r2.download_bytes.assert_called_once_with("documents/doc-123.pdf")
    mock_r2.upload_bytes.assert_called_once()
    mock_r2.generate_presigned_url.assert_called_once_with("toolkit/doc-123_compressed.pdf", expiration=86400)
