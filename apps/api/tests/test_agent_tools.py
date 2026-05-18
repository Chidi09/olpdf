import os

os.environ["SUPABASE_JWT_SECRET"] = "test-secret-for-testing-only"
os.environ["OLPDF_DEV_MODE"] = "true"

import json
from unittest.mock import patch, MagicMock

import fitz
import pytest

from apps.api.services.magic_agent_tools import (
    ALL_EXECUTORS,
    _INSPECTOR_EXECUTORS,
    _MUTATOR_EXECUTORS,
    _exec_get_pdf_info,
    _exec_peek_pages,
    _exec_reverse_pages,
    _exec_remove_metadata,
    _exec_compress,
    is_inspector_tool,
    is_mutator_tool,
)


def _make_pdf(page_count: int = 3) -> bytes:
    """Create a minimal in-memory PDF with given number of pages."""
    doc = fitz.open()
    doc.insert_page(-1, text=f"Page 0 content\nHello World")
    for i in range(1, page_count):
        doc.insert_page(-1, text=f"Page {i} content\nLine two")
    doc.set_metadata({"title": "Test Doc", "author": "Tester"})
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


import io


class TestInspectorTools:
    def test_get_pdf_info_returns_page_count_and_metadata(self):
        pdf = _make_pdf(5)
        result = _exec_get_pdf_info(pdf, {})
        info = json.loads(result)
        assert info["page_count"] == 5
        assert info["metadata"]["title"] == "Test Doc"
        assert info["metadata"]["author"] == "Tester"
        assert len(info["pages"]) == 5

    def test_get_pdf_info_reports_page_dimensions(self):
        pdf = _make_pdf(2)
        result = _exec_get_pdf_info(pdf, {})
        info = json.loads(result)
        for p in info["pages"]:
            assert p["width_points"] > 0
            assert p["height_points"] > 0
            assert p["index"] >= 0

    def test_peek_pages_returns_text_preview(self):
        pdf = _make_pdf(5)
        result = _exec_peek_pages(pdf, {"count": 2})
        data = json.loads(result)
        assert len(data["peeked_pages"]) == 2
        assert "Page 0" in data["peeked_pages"][0]["text_preview"]
        assert "Page 1" in data["peeked_pages"][1]["text_preview"]

    def test_peek_pages_defaults_to_3(self):
        pdf = _make_pdf(5)
        result = _exec_peek_pages(pdf, {})
        data = json.loads(result)
        assert len(data["peeked_pages"]) == 3

    def test_peek_pages_clamps_to_doc_length(self):
        pdf = _make_pdf(2)
        result = _exec_peek_pages(pdf, {"count": 10})
        data = json.loads(result)
        assert len(data["peeked_pages"]) == 2


class TestToolClassification:
    def test_inspector_tools_are_identified(self):
        assert is_inspector_tool("get_pdf_info") is True
        assert is_inspector_tool("peek_pages") is True
        assert is_inspector_tool("compress") is False

    def test_mutator_tools_are_identified(self):
        assert is_mutator_tool("compress") is True
        assert is_mutator_tool("extract_pages") is True
        assert is_mutator_tool("get_pdf_info") is False

    def test_all_executors_contains_inspectors_and_mutators(self):
        assert "get_pdf_info" in ALL_EXECUTORS
        assert "peek_pages" in ALL_EXECUTORS
        assert "compress" in ALL_EXECUTORS
        assert "extract_pages" in ALL_EXECUTORS


class TestMutatorTools:
    @pytest.mark.asyncio
    async def test_reverse_pages_reverses_order(self):
        pdf = _make_pdf(3)
        doc = fitz.open(stream=pdf, filetype="pdf")
        texts_before = [p.get_text().strip() for p in doc]
        doc.close()

        result = await _exec_reverse_pages(pdf, {})
        doc2 = fitz.open(stream=result, filetype="pdf")
        texts_after = [p.get_text().strip() for p in doc2]
        doc2.close()

        assert texts_after == list(reversed(texts_before))

    @pytest.mark.asyncio
    async def test_remove_metadata_strips_all_metadata(self):
        pdf = _make_pdf(1)
        doc = fitz.open(stream=pdf, filetype="pdf")
        assert doc.metadata.get("title") == "Test Doc"
        doc.close()

        result = await _exec_remove_metadata(pdf, {})
        doc2 = fitz.open(stream=result, filetype="pdf")
        meta = doc2.metadata or {}
        assert not meta.get("title")
        assert not meta.get("author")
        doc2.close()

    @pytest.mark.asyncio
    @patch("apps.api.services.magic_agent_tools.compress_pdf")
    async def test_compress_calls_export_utils(self, mock_compress):
        mock_compress.return_value = b"compressed-data"
        pdf = _make_pdf(1)
        result = await _exec_compress(pdf, {})
        mock_compress.assert_called_once_with(pdf)
        assert result == b"compressed-data"
