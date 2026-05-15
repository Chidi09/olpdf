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


def test_create_publication_returns_slug():
    with patch("apps.api.repositories.publication_repo.PublicationRepository.create") as mock_create:
        mock_create.return_value = {
            "slug": "abc12345",
            "title": "My Doc",
            "visibility": "unlisted",
            "status": "published",
            "url": "/p/abc12345",
        }

        response = client.post(
            "/api/publications",
            json={
                "source_type": "document",
                "source_id": "doc-1",
                "title": "My Doc",
                "snapshot": {"blocks": []},
                "visibility": "unlisted",
            },
            headers=AUTH_HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == "abc12345"
        assert data["url"] == "/p/abc12345"


def test_get_publication_returns_snapshot():
    with patch("apps.api.repositories.publication_repo.PublicationRepository.get_by_slug") as mock_get:
        mock_get.return_value = {
            "slug": "abc12345",
            "title": "My Doc",
            "snapshot": {"blocks": [{"id": "b1", "content": "Hello"}]},
            "status": "published",
            "visibility": "unlisted",
        }

        response = client.get("/api/publications/abc12345")

        assert response.status_code == 200
        assert response.json()["slug"] == "abc12345"
        assert response.json()["snapshot"]["blocks"][0]["content"] == "Hello"


def test_get_publication_missing_returns_404():
    with patch("apps.api.repositories.publication_repo.PublicationRepository.get_by_slug") as mock_get:
        mock_get.return_value = None

        response = client.get("/api/publications/nonexistent")
        assert response.status_code == 404


def test_create_requires_snapshot():
    response = client.post(
        "/api/publications",
        json={"source_id": "doc-1"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 422


def test_list_publications_returns_items():
    with patch("apps.api.repositories.publication_repo.PublicationRepository.list_for_owner") as mock_list:
        mock_list.return_value = [
            {"slug": "abc1", "title": "Doc 1", "status": "published"},
            {"slug": "abc2", "title": "Doc 2", "status": "published"},
        ]
        response = client.get("/api/publications?owner=user-1", headers=AUTH_HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert len(data["publications"]) == 2


def test_unpublish_publication():
    with patch("apps.api.repositories.publication_repo.PublicationRepository.unpublish") as mock_unpub:
        mock_unpub.return_value = True
        response = client.post("/api/publications/abc12345/unpublish", headers=AUTH_HEADERS)
        assert response.status_code == 200
        assert response.json()["status"] == "unpublished"


def test_update_visibility():
    with patch("apps.api.repositories.publication_repo.PublicationRepository.update_visibility") as mock_vis:
        mock_vis.return_value = True
        response = client.patch(
            "/api/publications/abc12345/visibility",
            json={"visibility": "public"},
            headers=AUTH_HEADERS,
        )
        assert response.status_code == 200
        assert response.json()["visibility"] == "public"
