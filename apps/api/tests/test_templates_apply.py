from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from apps.api.auth_utils import get_current_user
from apps.api.main import app


_MOCK_USER = {"sub": "test-user", "email": "test@example.com"}
app.dependency_overrides[get_current_user] = lambda: _MOCK_USER

client = TestClient(app)


@patch("apps.api.routes.templates.get_supabase")
@patch("apps.api.repositories.document_repo.DocumentRepository.create", return_value={"id": "doc-from-template"})
def test_apply_builtin_template_without_workspace_creates_user_document(mock_create, mock_supabase):
    class Query:
        data = None
        def select(self, *_a, **_k): return self
        def eq(self, *_a, **_k): return self
        def single(self): return self
        def execute(self): return self
    class Supabase:
        def table(self, _name): return Query()
    mock_supabase.return_value = Supabase()

    response = client.post("/templates/tpl_pitch-deck/apply", headers={"Authorization": "Bearer test-token"})

    assert response.status_code == 200
    data = response.json()
    assert data == {"document_id": "doc-from-template"}
