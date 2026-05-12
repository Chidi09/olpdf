"""Worker route robustness tests.

The only remaining worker route is /api/worker/cleanup-exports,
which is triggered by QStash cron and validated via Upstash-Signature.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from ..main import app

client = TestClient(app)


def test_cleanup_exports_rejects_missing_qstash():
    response = client.post(
        "/api/worker/cleanup-exports",
        json={"older_than_days": 7},
    )
    assert response.status_code == 401
    assert "QStash" in response.json().get("detail", "")
