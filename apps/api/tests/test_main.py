import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from apps.api.main import app

client = TestClient(app)


def test_health_check():
    with patch("apps.api.main.supabase.table") as mock_table:
        mock_table.return_value.select.return_value.limit.return_value.execute.return_value.data = [{}]
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


def test_unauthenticated_access_rejected():
    with patch("apps.api.main.supabase.table") as mock_table:
        mock_table.return_value.select.return_value.limit.return_value.execute.return_value.data = [{}]
        response = client.get("/api/documents/some-id")
        assert response.status_code == 401
        assert response.json() == {"error": "api_error", "message": "Missing bearer token"}


def test_payload_too_large():
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
    payload = {
        "document_id": "550e8400-e29b-41d4-a716-446655440000",
        "file_bytes": "YmFzZTY0"
    }
    with patch("apps.api.routes.worker.worker_secret") as mock_secret:
        mock_secret.return_value = "test-secret"
        with patch("apps.api.routes.worker.route_pdf_import", new_callable=AsyncMock) as mock_import:
            mock_import.return_value = None
            response = client.post("/api/worker/process-import", json=payload)
            # No QStash signature header → should fail QStash verification (401)
            assert response.status_code == 401
            assert "QStash" in response.json().get("message", "")
            mock_import.assert_not_called()
