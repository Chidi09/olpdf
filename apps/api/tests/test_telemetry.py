from fastapi.testclient import TestClient
from unittest.mock import patch

from apps.api.auth_utils import require_auth
from apps.api.main import app

_MOCK_USER = {"sub": "test-user", "email": "test@example.com"}
app.dependency_overrides[require_auth] = lambda: _MOCK_USER

client = TestClient(app)


def test_export_telemetry_accepts_payload():
    payload = {
        "documentId": "doc-123",
        "layoutMode": "fidelity",
        "format": "fidelity",
        "elapsedMs": 314,
        "phase": "success",
    }

    with patch("apps.api.main.verify_jwt_token", return_value={"sub": "test-user"}):
        response = client.post(
            "/api/telemetry/export",
            json=payload,
            headers={"Authorization": "Bearer test-token"},
        )

    assert response.status_code == 202
    assert response.json() == {"status": "accepted"}
