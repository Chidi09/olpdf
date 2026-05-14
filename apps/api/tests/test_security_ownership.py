import pytest
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.auth_utils import require_auth
from unittest.mock import patch

client = TestClient(app)

# We will dynamically override require_auth in tests
class MockAuth:
    def __init__(self):
        self.user = {"sub": "user123"}
    
    def __call__(self):
        return self.user

mock_auth = MockAuth()
app.dependency_overrides[require_auth] = mock_auth

def test_document_ownership_enforcement():
    app.dependency_overrides[require_auth] = mock_auth
    # Mock document owned by user123
    mock_doc = {"id": "doc1", "user_id": "user123", "document_model": {"blocks": []}}
    
    with patch("apps.api.repositories.DocumentRepository.get_by_id", return_value=mock_doc):
        # Access by owner should succeed
        mock_auth.user = {"sub": "user123"}
        response = client.get("/api/documents/doc1", headers={"Authorization": "Bearer token"})
        assert response.status_code == 200
            
        # Access by other user should fail
        mock_auth.user = {"sub": "other456"}
        response = client.get("/api/documents/doc1", headers={"Authorization": "Bearer token"})
        assert response.status_code == 403

def test_book_ownership_enforcement():
    app.dependency_overrides[require_auth] = mock_auth
    # Mock book owned by user123
    mock_book = {"id": "book1", "user_id": "user123", "title": "My Book"}
    
    with patch("apps.api.repositories.BookRepository.get_by_id", return_value=mock_book):
        # Access by owner should succeed
        mock_auth.user = {"sub": "user123"}
        with patch("apps.api.repositories.BookRepository.get_chapters", return_value=[]):
            response = client.get("/api/books/book1", headers={"Authorization": "Bearer token"})
            assert response.status_code == 200
            
        # Access by other user should fail
        mock_auth.user = {"sub": "other456"}
        response = client.get("/api/books/book1", headers={"Authorization": "Bearer token"})
        assert response.status_code == 403

def test_not_found_resource():
    app.dependency_overrides[require_auth] = mock_auth
    with patch("apps.api.repositories.DocumentRepository.get_by_id", return_value=None):
        mock_auth.user = {"sub": "user123"}
        response = client.get("/api/documents/nonexistent", headers={"Authorization": "Bearer token"})
        assert response.status_code == 404
