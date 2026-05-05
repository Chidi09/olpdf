import pytest
from fastapi.testclient import TestClient
from apps.api.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_unauthenticated_access_rejected():
    response = client.get("/api/documents/some-id")
    assert response.status_code == 401
    assert response.json() == {"error": "api_error", "message": "Missing bearer token"}

def test_payload_too_large():
    # Max size is 10MB
    large_body = "x" * (11 * 1024 * 1024)
    response = client.post("/api/documents/create", content=large_body, headers={
        "Authorization": "Bearer test-token",
        "Content-Type": "application/json"
    })
    assert response.status_code == 413
    assert response.json()["message"] == "Payload too large (max 10MB)"

def test_request_id_propagation():
    response = client.get("/health", headers={"X-Request-ID": "custom-id"})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "custom-id"
    assert "X-Process-Time" in response.headers

def test_worker_route_skips_jwt():
    # Worker routes use QStash signature, so they should skip the JWT middleware gate
    # We expect 401 because QStash signature is missing, NOT because JWT is missing.
    # If it was blocked by JWT gate, it would return "Missing bearer token"
    response = client.post("/api/worker/process-import")
    assert response.status_code == 401
    assert response.json()["message"] == "Invalid QStash signature"
