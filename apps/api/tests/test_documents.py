import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from apps.api.main import app
from apps.api.auth_utils import require_auth

_MOCK_USER = {"sub": "test-user", "email": "test@example.com"}
app.dependency_overrides[require_auth] = lambda: _MOCK_USER

client = TestClient(app)


@patch("apps.api.routes.documents.DocumentRepository")
@patch("apps.api.routes.documents.AuditLogRepository")
def test_create_document(mock_audit, mock_repo):
    mock_repo.create.return_value = {"id": "new-doc-id", "status": "created"}

    payload = {"meta": {"title": "Test Doc"}, "blocks": []}
    response = client.post(
        "/api/documents/create",
        json=payload,
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    assert response.json() == {"id": "new-doc-id", "status": "created"}
    mock_repo.create.assert_called_once()
    mock_audit.create.assert_called_once()


@patch("apps.api.repositories.document_repo.DocumentRepository.get_by_id")
def test_get_document_ownership(mock_get):
    mock_get.return_value = {"id": "doc-123", "user_id": "other-user", "document_model": {"blocks": []}}

    response = client.get(
        "/api/documents/doc-123",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 403
    assert response.json() == {"error": "api_error", "message": "Forbidden"}


@patch("apps.api.repositories.document_repo.DocumentRepository.get_by_id")
def test_get_document_success(mock_get):
    mock_get.return_value = {
        "id": "doc-123",
        "user_id": "test-user",
        "document_model": {"blocks": [{"id": "1", "type": "paragraph", "content": "hello"}]},
    }

    response = client.get(
        "/api/documents/doc-123",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    assert response.json()["id"] == "doc-123"
    assert response.json()["document_model"]["blocks"][0]["content"] == "hello"


@patch("apps.api.repositories.document_repo.DocumentRepository.get_by_id")
@patch("apps.api.routes.documents.r2_storage")
def test_document_preview(mock_r2, mock_get):
    mock_get.return_value = {
        "id": "doc-123",
        "user_id": "test-user",
        "document_model": {"blocks": []},
    }
    mock_r2.object_exists.return_value = True
    mock_r2.generate_presigned_url.return_value = "https://example.com/preview.pdf"

    response = client.get(
        "/api/documents/doc-123/preview",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    assert response.json()["preview_url"] == "https://example.com/preview.pdf"


@patch("apps.api.repositories.document_repo.DocumentRepository.get_by_id")
@patch("apps.api.routes.documents.r2_storage")
def test_document_preview_missing_object_returns_404(mock_r2, mock_get):
    mock_get.return_value = {
        "id": "doc-123",
        "user_id": "test-user",
        "document_model": {"blocks": []},
    }
    mock_r2.object_exists.return_value = False

    response = client.get(
        "/api/documents/doc-123/preview",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 404
    assert response.json()["message"] == "PDF preview is not available yet"
    mock_r2.generate_presigned_url.assert_not_called()
