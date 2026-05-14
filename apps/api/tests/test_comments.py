from unittest.mock import patch

from fastapi.testclient import TestClient

from apps.api.main import app

client = TestClient(app)


def test_list_comments_returns_empty_on_query_failure():
    with (
        patch("apps.api.main.verify_jwt_token", return_value={"sub": "test-user"}),
        patch("apps.api.core.auth.verify_jwt_token", return_value={"sub": "test-user"}),
        patch("apps.api.routes.comments.check_ownership", return_value={"id": "doc-123"}),
        patch("apps.api.routes.comments.supabase") as mock_supabase,
    ):
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.side_effect = Exception(
            "DB unavailable"
        )

        response = client.get(
            "/api/documents/doc-123/comments/",
            headers={"Authorization": "Bearer test-token"},
        )

        assert response.status_code == 200
        assert response.json() == []
