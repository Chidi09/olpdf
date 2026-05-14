import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from apps.api.main import app
from apps.api.auth_utils import require_auth

client = TestClient(app)


def test_health_check():
    with patch("apps.api.main.supabase.table") as mock_table:
        mock_table.return_value.select.return_value.limit.return_value.execute.return_value.data = [{}]
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy", "checks": {"db": "ok"}}


def test_unauthenticated_access_rejected():
    app.dependency_overrides.clear()
    with patch("apps.api.main.supabase.table") as mock_table:
        mock_table.return_value.select.return_value.limit.return_value.execute.return_value.data = [{}]
        response = client.get("/api/documents/some-id")
        assert response.status_code == 401
        assert response.json()["message"] == "Authentication required"


def test_payload_too_large():
    app.dependency_overrides.clear()
    large_body = "x" * (11 * 1024 * 1024)
    response = client.post("/api/documents/create", content=large_body, headers={
        "Authorization": "Bearer test-token",
        "Content-Type": "application/json"
    })
    assert response.status_code == 413
    assert response.json()["message"] == "Payload too large (max 10MB)"


def test_request_id_propagation():
    with patch("apps.api.main.supabase.table") as mock_table:
        mock_table.return_value.select.return_value.limit.return_value.execute.return_value.data = [{}]
        response = client.get("/health", headers={"X-Request-ID": "custom-id"})
        assert response.status_code == 200
        assert response.headers["X-Request-ID"] == "custom-id"
        assert "X-Process-Time" in response.headers


def test_worker_route_skips_jwt():
    response = client.post("/api/worker/cleanup-exports", json={"older_than_days": 7})
    # No QStash signature header -> should fail QStash verification, not JWT auth.
    assert response.status_code == 401
    assert "QStash" in response.json().get("message", "")
