import os
from unittest.mock import patch
from fastapi.testclient import TestClient
from apps.api.main import app

os.environ["SUPABASE_JWT_SECRET"] = "test-secret-for-testing-only"
client = TestClient(app)

AUTH_HEADERS = {"Authorization": "Bearer test-token"}


def test_export_returns_presigned_url():
    with (
        patch("apps.api.main.verify_jwt_token") as mock_jwt,
        patch("apps.api.routes.documents.check_ownership") as mock_owner,
        patch("apps.api.routes.documents.r2_storage") as mock_r2,
    ):
        mock_jwt.return_value = {"sub": "user-1"}
        mock_owner.return_value = {"id": "doc-1"}
        mock_r2.upload_bytes.return_value = "https://raw-r2.example/olpdf/exports/doc-1.fidelity"
        mock_r2.upload_bytes_and_presign.return_value = "https://signed-r2.example/olpdf/exports/doc-1.fidelity?X-Amz-Signature=abc"
        mock_r2.generate_presigned_url.return_value = "https://signed-r2.example/olpdf/exports/doc-1.fidelity?X-Amz-Signature=abc"

        response = client.post(
            "/api/documents/doc-1/export/fidelity",
            json={
                "document_model": {
                    "id": "doc-1",
                    "meta": {"title": "Test Doc", "layout_mode": "fidelity", "color_space": "rgb"},
                    "blocks": [
                        {"id": "blk_1", "type": "paragraph", "content": "Hello", "bounding_box": [72, 72, 120, 90]}
                    ],
                    "page_dimensions": [{"page_index": 0, "width": 612, "height": 792}],
                    "styles": {},
                },
                "font_metrics": {},
            },
            headers=AUTH_HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "X-Amz-Signature" in data["url"]
        mock_r2.upload_bytes_and_presign.assert_called_once()


def test_export_fails_when_upload_fails():
    with (
        patch("apps.api.main.verify_jwt_token") as mock_jwt,
        patch("apps.api.routes.documents.check_ownership") as mock_owner,
        patch("apps.api.routes.documents.r2_storage") as mock_r2,
    ):
        mock_jwt.return_value = {"sub": "user-1"}
        mock_owner.return_value = {"id": "doc-1"}
        mock_r2.upload_bytes_and_presign.return_value = None

        response = client.post(
            "/api/documents/doc-1/export/fidelity",
            json={
                "document_model": {
                    "id": "doc-1",
                    "meta": {"title": "Test", "layout_mode": "fidelity", "color_space": "rgb"},
                    "blocks": [],
                    "page_dimensions": [],
                    "styles": {},
                },
                "font_metrics": {},
            },
            headers=AUTH_HEADERS,
        )

        assert response.status_code == 500
        data = response.json()
        assert "detail" in data
