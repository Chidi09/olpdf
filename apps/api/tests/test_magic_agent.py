import os

os.environ["SUPABASE_JWT_SECRET"] = "test-secret-for-testing-only"
os.environ["OLPDF_DEV_MODE"] = "true"

import io
from unittest.mock import patch, MagicMock

import fitz
import pytest

from apps.api.services.magic_agent import MagicAgent


def _make_pdf_bytes() -> bytes:
    doc = fitz.open()
    doc.insert_page(-1, text="Hello World")
    doc.insert_page(-1, text="Page Two Content")
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


@pytest.fixture
def mock_genai():
    """Patch google.generativeai at the module level."""
    with patch("apps.api.services.magic_agent.genai") as mock:
        mock_model = MagicMock()
        mock_chat = MagicMock()
        mock_model.start_chat.return_value = mock_chat
        mock.GenerativeModel.return_value = mock_model
        yield mock, mock_model, mock_chat


def _make_fc_response(fc_name: str, fc_args: dict):
    from google.generativeai import protos
    fc = protos.FunctionCall(name=fc_name, args=fc_args)
    fc_part = protos.Part(function_call=fc)
    content = protos.Content(role="model", parts=[fc_part])
    candidate = protos.Candidate(content=content)
    resp = MagicMock()
    resp.candidates = [candidate]
    return resp


def _make_text_response(text: str):
    from google.generativeai import protos
    text_part = protos.Part(text=text)
    content = protos.Content(role="model", parts=[text_part])
    candidate = protos.Candidate(content=content)
    resp = MagicMock()
    resp.candidates = [candidate]
    return resp


async def _collect_events(agent, doc_id, instruction):
    events = []
    async for evt in agent.run(doc_id, instruction):
        events.append(evt)
    return events


@pytest.mark.asyncio
@patch("apps.api.services.magic_agent.download_pdf_bytes")
@patch("apps.api.services.magic_agent.upload_result_bytes")
async def test_agent_completes_with_no_tool_calls(
    mock_upload, mock_download, mock_genai
):
    mock_genai, _, mock_chat = mock_genai
    mock_download.return_value = _make_pdf_bytes()
    mock_upload.return_value = "https://example.com/result.pdf"

    mock_chat.send_message.return_value = _make_text_response(
        "The PDF has 2 pages. No operations needed."
    )

    agent = MagicAgent()
    events = await _collect_events(agent, "doc-123", "just tell me about it")

    thought = [e for e in events if e["type"] == "thought"]
    complete = [e for e in events if e["type"] == "complete"]
    assert len(thought) >= 1
    assert len(complete) >= 1
    assert complete[0]["url"] == "https://example.com/result.pdf"


@pytest.mark.asyncio
@patch("apps.api.services.magic_agent.download_pdf_bytes")
@patch("apps.api.services.magic_agent.upload_result_bytes")
async def test_agent_executes_one_tool_then_completes(
    mock_upload, mock_download, mock_genai
):
    mock_genai, _, mock_chat = mock_genai
    mock_download.return_value = _make_pdf_bytes()
    mock_upload.return_value = "https://example.com/result.pdf"

    fc_resp = _make_fc_response("peek_pages", {"count": 2})
    text_resp = _make_text_response("Pages have content.")
    mock_chat.send_message.side_effect = [fc_resp, text_resp]

    agent = MagicAgent()
    events = await _collect_events(agent, "doc-123", "check pages")

    action = [e for e in events if e["type"] == "action"]
    observation = [e for e in events if e["type"] == "observation"]
    complete = [e for e in events if e["type"] == "complete"]
    assert len(action) >= 1
    assert action[0]["tool"] == "peek_pages"
    assert len(observation) >= 1
    assert len(complete) >= 1


@pytest.mark.asyncio
@patch("apps.api.services.magic_agent.download_pdf_bytes")
@patch("apps.api.services.magic_agent.upload_result_bytes")
async def test_agent_reports_error_for_unknown_tool(
    mock_upload, mock_download, mock_genai
):
    mock_genai, _, mock_chat = mock_genai
    mock_download.return_value = _make_pdf_bytes()
    mock_upload.return_value = "https://example.com/result.pdf"

    fc_resp = _make_fc_response("nonexistent_tool", {})
    text_resp = _make_text_response("That tool is not available.")
    mock_chat.send_message.side_effect = [fc_resp, text_resp]

    agent = MagicAgent()
    events = await _collect_events(agent, "doc-123", "do something")

    observation = [e for e in events if e["type"] == "observation"]
    errors = [e for e in observation if "Unknown" in e["content"]]
    assert len(errors) >= 1


@pytest.mark.asyncio
@patch("apps.api.services.magic_agent.download_pdf_bytes")
@patch("apps.api.services.magic_agent.upload_result_bytes")
async def test_agent_stores_analysis_results(
    mock_upload, mock_download, mock_genai
):
    mock_genai, _, mock_chat = mock_genai
    mock_download.return_value = _make_pdf_bytes()
    mock_upload.return_value = "https://example.com/result.pdf"

    fc_resp = _make_fc_response("extract_text", {})
    text_resp = _make_text_response("Extracted text successfully.")
    mock_chat.send_message.side_effect = [fc_resp, text_resp]

    agent = MagicAgent()
    events = await _collect_events(agent, "doc-123", "extract text")

    complete = [e for e in events if e["type"] == "complete"]
    assert len(complete) >= 1
    analysis = complete[0].get("analysis")
    assert analysis is not None
    assert len(analysis) >= 1
    assert analysis[0]["tool"] == "extract_text"


@pytest.mark.asyncio
@patch("apps.api.services.magic_agent.download_pdf_bytes")
async def test_agent_returns_error_if_pdf_not_found(mock_download, mock_genai):
    mock_download.side_effect = ValueError("Original PDF not found")
    agent = MagicAgent()
    events = await _collect_events(agent, "doc-missing", "do stuff")

    error = [e for e in events if e["type"] == "error"]
    assert len(error) >= 1
