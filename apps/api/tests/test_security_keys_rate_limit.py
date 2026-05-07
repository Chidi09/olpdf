import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from ..main import app
from ..limiter import limiter

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_limiter():
    # Reset limiter before each test to ensure deterministic results
    limiter._storage.reset()
    yield

def test_api_key_authentication_failure():
    """Verify that an invalid API key returns 401."""
    with patch("apps.api.auth_utils.ApiKeyRepository.get_by_hash") as mock_get:
        mock_get.return_value = None
        response = client.get("/api/documents/some-id", headers={"X-API-Key": "invalid-key"})
        assert response.status_code == 401
        assert response.json()["message"] == "Invalid API key"

def test_api_key_authentication_success():
    """Verify that a valid API key allows access."""
    with patch("apps.api.auth_utils.ApiKeyRepository.get_by_hash") as mock_get:
        mock_get.return_value = {
            "id": "key-123",
            "user_id": "user-456",
            "name": "Test Key"
        }
        with patch("apps.api.auth_utils.ApiKeyRepository.update_last_used"):
            with patch("apps.api.auth_utils.DocumentRepository.get_by_id") as mock_doc:
                mock_doc.return_value = {"id": "doc-1", "user_id": "user-456", "document_model": {}}
                
                response = client.get("/api/documents/doc-1", headers={"X-API-Key": "valid-key"})
                assert response.status_code == 200
                assert response.json()["id"] == "doc-1"

def test_rate_limiting():
    """Verify that exceeding rate limits returns 429."""
    with patch("apps.api.auth_utils.verify_jwt_token") as mock_verify:
        mock_verify.return_value = {"sub": "user-123", "auth_type": "jwt"}
        with patch("apps.api.routes.documents.DocumentRepository.create") as mock_create:
            mock_create.return_value = {"id": "new-doc", "status": "created"}
            
            # Make 10 requests (limit is 10/minute)
            for _ in range(10):
                response = client.post(
                    "/api/documents/create", 
                    json={"meta": {"title": "Test", "layout_mode": "editable"}, "blocks": [], "styles": {}},
                    headers={"Authorization": "Bearer some-token"}
                )
                assert response.status_code == 200
            
            # The 11th request should fail
            response = client.post(
                "/api/documents/create", 
                json={"meta": {"title": "Test", "layout_mode": "editable"}, "blocks": [], "styles": {}},
                headers={"Authorization": "Bearer some-token"}
            )
            assert response.status_code == 429

def test_api_key_management_flow():
    """Verify the API key creation and listing flow."""
    with patch("apps.api.auth_utils.verify_jwt_token") as mock_verify:
        mock_verify.return_value = {"sub": "user-123", "auth_type": "jwt"}
        with patch("apps.api.routes.api_keys.ApiKeyRepository.create") as mock_create:
            mock_create.return_value = {
                "id": "key-1",
                "name": "Production",
                "prefix": "olp_abc",
                "key": "olp_abc_secret"
            }
            with patch("apps.api.routes.api_keys.ApiKeyRepository.list_for_user") as mock_list:
                mock_list.return_value = [
                    {
                        "id": "key-1",
                        "name": "My Key",
                        "prefix": "olp_abc",
                        "last_used_at": None,
                        "created_at": "2026-05-06T12:00:00"
                    }
                ]
                
                # 1. Create Key
                response = client.post(
                    "/api/keys?name=Production",
                    headers={"Authorization": "Bearer some-token"}
                )
                assert response.status_code == 200
                assert "key" in response.json()
                assert response.json()["name"] == "Production"
                
                # 2. List Keys
                response = client.get(
                    "/api/keys",
                    headers={"Authorization": "Bearer some-token"}
                )
                assert response.status_code == 200
                assert len(response.json()) == 1
                assert response.json()[0]["name"] == "My Key"
