import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, ANY
from ..main import app
from .. import limiter as limiter_module

client = TestClient(app)

_MOCK_USER = {"sub": "user-123", "auth_type": "jwt", "email": "test@example.com"}

@pytest.fixture(autouse=True)
def reset_limiter():
    limiter_module.limiter._storage.reset()
    yield

def test_api_key_authentication_failure():
    with patch("apps.api.core.auth.ApiKeyRepository.get_by_hash") as mock_get:
        mock_get.return_value = None
        response = client.get("/api/documents/some-id", headers={"X-API-Key": "invalid-key"})
        assert response.status_code == 401
        assert response.json()["message"] == "Invalid API key"

def test_api_key_authentication_success():
    with patch("apps.api.core.auth.ApiKeyRepository.get_by_hash") as mock_get:
        mock_get.return_value = {
            "id": "key-123",
            "user_id": "user-456",
            "name": "Test Key",
            "expires_at": None,
            "scopes": None,
        }
        with patch("apps.api.core.auth.ApiKeyRepository.update_last_used"):
            with patch("apps.api.repositories.document_repo.DocumentRepository.get_by_id") as mock_doc:
                mock_doc.return_value = {"id": "doc-1", "user_id": "user-456", "document_model": {}}
                
                response = client.get("/api/documents/doc-1", headers={"X-API-Key": "valid-key"})
                assert response.status_code == 200
                assert response.json()["id"] == "doc-1"

def test_rate_limiting():
    _MOCK_USER["sub"] = "user-rate-test"
    with patch("apps.api.auth_utils.verify_jwt_token") as mock_verify:
        mock_verify.return_value = _MOCK_USER
        with patch("apps.api.repositories.document_repo.DocumentRepository.create") as mock_create:
            mock_create.return_value = {"id": "new-doc", "status": "created"}
            with patch("apps.api.repositories.workspace_repo.AuditLogRepository.create"):
                
                for _ in range(10):
                    response = client.post(
                        "/api/documents/create", 
                        json={"meta": {"title": "Test", "layout_mode": "editable"}, "blocks": [], "styles": {}},
                        headers={"Authorization": "Bearer rate-test-token"}
                    )
                    assert response.status_code == 200
                
                response = client.post(
                    "/api/documents/create", 
                    json={"meta": {"title": "Test", "layout_mode": "editable"}, "blocks": [], "styles": {}},
                    headers={"Authorization": "Bearer rate-test-token"}
                )
                assert response.status_code == 429

def test_api_key_management_flow():
    with patch("apps.api.auth_utils.verify_jwt_token") as mock_verify:
        mock_verify.return_value = _MOCK_USER
        with patch("apps.api.repositories.user_repo.ApiKeyRepository.create") as mock_create:
            mock_create.return_value = {
                "id": "key-1",
                "name": "Production",
                "prefix": "olp_abc",
            }
            with patch("apps.api.repositories.workspace_repo.AuditLogRepository.create"):
                with patch("apps.api.repositories.user_repo.ApiKeyRepository.list_for_user") as mock_list:
                    mock_list.return_value = [
                        {
                            "id": "key-1",
                            "name": "My Key",
                            "prefix": "olp_abc",
                            "scopes": [],
                            "last_used_at": None,
                            "created_at": "2026-05-06T12:00:00"
                        }
                    ]
                    
                    response = client.post(
                        "/api/keys",
                        json={"name": "Production", "scopes": ["documents:read"]},
                        headers={"Authorization": "Bearer some-token"}
                    )
                    assert response.status_code == 200
                    assert "key" in response.json()
                    assert response.json()["name"] == "Production"
                    
                    response = client.get(
                        "/api/keys",
                        headers={"Authorization": "Bearer some-token"}
                    )
                    assert response.status_code == 200
                    assert len(response.json()) == 1
                    assert response.json()[0]["name"] == "My Key"
