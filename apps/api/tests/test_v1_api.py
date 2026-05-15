from fastapi.testclient import TestClient
from apps.api.main import create_app

client = TestClient(create_app())

AUTH_HEADERS = {"Authorization": "Bearer test-token"}


def test_v1_health_shape():
    response = client.get("/v1/health", headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.json()["status"] in {"ok", "healthy"}


def test_v1_extract_route_exists():
    response = client.post(
        "/v1/extract",
        json={"url": "https://example.com/a.pdf", "mode": "semantic"},
        headers=AUTH_HEADERS,
    )
    assert response.status_code not in (404, 405)
