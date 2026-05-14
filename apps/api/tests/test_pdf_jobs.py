import os

os.environ["SUPABASE_JWT_SECRET"] = "test-secret-for-testing-only"
os.environ["OLPDF_DEV_MODE"] = "true"
os.environ["WORKER_SECRET"] = "test-worker-secret"

from unittest.mock import patch
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.auth_utils import require_auth

_MOCK_USER = {"sub": "user-1", "email": "test@example.com"}
app.dependency_overrides[require_auth] = lambda: _MOCK_USER

client = TestClient(app)


def test_create_pdf_job():
    app.dependency_overrides[require_auth] = lambda: _MOCK_USER
    with (
        patch("apps.api.routes.pdf_jobs.check_ownership") as mock_owner,
        patch("apps.api.routes.pdf_jobs.PdfJobRepository.create") as mock_create,
    ):
        mock_owner.return_value = {"id": "doc-1"}
        mock_create.return_value = {"id": "job-1", "status": "queued", "operation": "compress"}

        response = client.post(
            "/api/pdf-jobs",
            json={"document_id": "doc-1", "operation": "compress"},
            headers={"Authorization": "Bearer test-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "queued"
        assert data["id"] == "job-1"


def test_get_pdf_job():
    app.dependency_overrides[require_auth] = lambda: _MOCK_USER
    with (
        patch("apps.api.routes.pdf_jobs.PdfJobRepository.get_by_id") as mock_get,
    ):
        mock_get.return_value = {
            "id": "job-1",
            "owner_id": "user-1",
            "document_id": "doc-1",
            "operation": "compress",
            "status": "running",
            "progress": 50,
            "message": "Processing pages",
        }

        response = client.get("/api/pdf-jobs/job-1", headers={"Authorization": "Bearer test-token"})

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "running"
        assert data["progress"] == 50


def test_update_pdf_job_requires_worker_secret():
    app.dependency_overrides[require_auth] = lambda: _MOCK_USER
    response = client.patch(
        "/api/pdf-jobs/job-1",
        json={"status": "running", "progress": 50},
    )
    assert response.status_code == 401


def test_update_pdf_job_with_valid_secret():
    app.dependency_overrides[require_auth] = lambda: _MOCK_USER
    with (
        patch("apps.api.routes.pdf_jobs.PdfJobRepository.get_by_id") as mock_get,
        patch("apps.api.routes.pdf_jobs.PdfJobRepository.update") as mock_update,
    ):
        mock_get.return_value = {
            "id": "job-1",
            "owner_id": "user-1",
            "document_id": "doc-1",
            "operation": "compress",
            "status": "queued",
        }

        response = client.patch(
            "/api/pdf-jobs/job-1",
            json={"status": "succeeded"},
            headers={"X-Worker-Secret": "test-worker-secret"},
        )

        assert response.status_code == 200
        mock_update.assert_called_once()
