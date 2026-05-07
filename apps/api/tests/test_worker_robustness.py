import pytest
from fastapi.testclient import TestClient
from apps.api.main import app
from unittest.mock import patch, MagicMock
import os

client = TestClient(app)

@pytest.fixture
def mock_worker_secret():
    os.environ["WORKER_SECRET"] = "test-secret"
    yield "test-secret"
    del os.environ["WORKER_SECRET"]

def test_ocr_complete_callback_idempotency_behavior(mock_worker_secret):
    # This test verifies that multiple callbacks for the same document behave correctly (notifications sent)
    # In a real scenario, we might want to deduplicate notifications, but currently they are fire-and-forget.
    # The robustness is primarily in the worker side (deduplicating blocks), which we'll test separately if needed.
    
    document_id = "doc123"
    payload = {
        "document_id": document_id,
        "status": "ready",
        "pages_ocr": 1,
        "failed_pages": [],
        "blocks_added": 10
    }
    
    headers = {"X-Worker-Secret": mock_worker_secret}
    
    with patch("apps.api.supabase_client.supabase.table") as mock_table:
        mock_table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            "title": "Test Doc",
            "user_id": "user123"
        }
        
        with patch("apps.api.notification_utils.send_import_complete_notification") as mock_notify:
            # First call
            response = client.post("/api/worker/ocr-complete", json=payload, headers=headers)
            assert response.status_code == 200
            assert mock_notify.call_count == 1
            
            # Second call (duplicate)
            response = client.post("/api/worker/ocr-complete", json=payload, headers=headers)
            assert response.status_code == 200
            # Currently it sends another notification. In the future we might want to check a 'processed' flag.
            assert mock_notify.call_count == 2

def test_ocr_complete_partial_notification(mock_worker_secret):
    document_id = "doc123"
    payload = {
        "document_id": document_id,
        "status": "partial",
        "pages_ocr": 2,
        "failed_pages": [1], # One page failed
        "blocks_added": 5
    }
    
    headers = {"X-Worker-Secret": mock_worker_secret}
    
    with patch("apps.api.supabase_client.supabase.table") as mock_table:
        mock_table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            "title": "Test Doc",
            "user_id": "user123"
        }
        
        with patch("apps.api.notification_utils.send_ocr_partial_notification") as mock_notify:
            response = client.post("/api/worker/ocr-complete", json=payload, headers=headers)
            assert response.status_code == 200
            mock_notify.assert_called_once_with("user123", "Test Doc", document_id, 1)

def test_invalid_worker_secret(mock_worker_secret):
    response = client.post("/api/worker/ocr-complete", json={"document_id": "123"}, headers={"X-Worker-Secret": "wrong"})
    assert response.status_code == 401
