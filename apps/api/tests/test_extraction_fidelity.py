import pytest
from apps.api.worker_utils import extract_native_page
from unittest.mock import MagicMock

def test_extract_native_page_fidelity():
    # Mock a PDF page with words having specific font attributes
    mock_page = MagicMock()
    # pdfplumber extract_words returns a list of dictionaries with font info
    mock_page.extract_words.return_value = [
        {
            "text": "Hello",
            "x0": 100.0, "top": 100.0, "x1": 150.0, "bottom": 120.0,
            "fontname": "Helvetica-Bold",
            "size": 12.0,
            "nonstroking_color": [0, 0, 0]
        }
    ]
    # Simulate page dimensions
    mock_page.width = 600
    mock_page.height = 800

    # Act
    # Note: We expect to update the signature/implementation of extract_native_page
    # to handle this new word-level extraction.
    result = extract_native_page(mock_page, 0)
    
    # Assert
    assert len(result) > 0
    block = result[0]
    assert block["content"] == "Hello"
    assert "font_meta" in block
    assert block["font_meta"]["family"] == "Helvetica-Bold"
    assert block["font_meta"]["size"] == 12.0
    assert block["font_meta"]["is_bold"] is True
