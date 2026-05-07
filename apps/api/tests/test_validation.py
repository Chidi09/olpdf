import pytest
from fastapi.testclient import TestClient
from apps.api.main import app
from apps.api.models import DocumentModel, DocumentMeta, DocumentBlock, FontMeta

client = TestClient(app)

def test_hardened_document_meta_validation():
    # Test title length constraint
    bad_meta = {
        "title": "A" * 256,
        "page_size": "A4"
    }
    with pytest.raises(Exception): # Pydantic will raise ValidationError
        DocumentMeta(**bad_meta)

def test_hardened_font_meta_validation():
    # Test color regex
    bad_font = {
        "color": "not-a-color"
    }
    with pytest.raises(Exception):
        FontMeta(**bad_font)
        
    # Test size range
    bad_font = {
        "size": 600
    }
    with pytest.raises(Exception):
        FontMeta(**bad_font)

def test_extra_forbid_validation():
    # Test extra field rejection
    bad_block = {
        "id": "block1",
        "type": "paragraph",
        "unknown_field": "error"
    }
    with pytest.raises(Exception):
        DocumentBlock(**bad_block)

def test_api_rejection_of_invalid_payload():
    # Test API endpoint rejection of invalid payload
    invalid_doc = {
        "meta": {
            "title": "A" * 256
        },
        "blocks": []
    }
    # We need to simulate a real request. 
    # Since we use dev-user and mock repositories, this should hit validation before repo.
    response = client.post("/api/documents/create", json=invalid_doc, headers={"Authorization": "Bearer dev-token"})
    assert response.status_code == 422 # Unprocessable Entity
    
    # Test extra field rejection in API
    invalid_doc = {
        "meta": {"title": "Valid"},
        "blocks": [],
        "extra_field": "should_fail"
    }
    response = client.post("/api/documents/create", json=invalid_doc, headers={"Authorization": "Bearer dev-token"})
    assert response.status_code == 422

def test_bbox_validation():
    # Test bbox length
    bad_block = {
        "id": "block1",
        "type": "paragraph",
        "bounding_box": [1.0, 2.0, 3.0] # Only 3 elements
    }
    with pytest.raises(Exception):
        DocumentBlock(**bad_block)
        
    bad_block = {
        "id": "block1",
        "type": "paragraph",
        "bounding_box": [1.0, 2.0, 3.0, 4.0, 5.0] # 5 elements
    }
    with pytest.raises(Exception):
        DocumentBlock(**bad_block)
