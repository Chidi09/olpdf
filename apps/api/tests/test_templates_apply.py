from fastapi.testclient import TestClient
from unittest.mock import patch

from apps.api.auth_utils import get_current_user
from apps.api.main import app


_MOCK_USER = {"sub": "test-user", "email": "test@example.com"}
app.dependency_overrides[get_current_user] = lambda: _MOCK_USER

client = TestClient(app)


@patch("apps.api.routes.templates.DocumentRepository.create")
@patch("apps.api.routes.templates.get_supabase")
def test_apply_builtin_template_without_workspace_creates_user_document(mock_supabase, mock_create):
    class Query:
        data = None

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def single(self):
            return self

        def execute(self):
            return self

    class Supabase:
        def table(self, _name):
            return Query()

    mock_supabase.return_value = Supabase()
    mock_create.return_value = {"id": "doc-from-template"}

    response = client.post("/templates/tpl_pitch-deck/apply", headers={"Authorization": "Bearer test-token"})

    assert response.status_code == 200
    assert response.json() == {"document_id": "doc-from-template"}
    _, model = mock_create.call_args.args[:2]
    assert mock_create.call_args.kwargs["user_id"] == "test-user"
    assert "workspace_id" not in mock_create.call_args.kwargs or mock_create.call_args.kwargs["workspace_id"] is None
    assert isinstance(model["blocks"][0]["content"], str)
