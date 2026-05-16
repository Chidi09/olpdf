import pytest

from apps.api.services import ocr_service
from apps.api.services.ocr_classifier import OcrRoute


@pytest.mark.asyncio
async def test_cloud_vision_provider_routes_all_pages_to_cloud_vision(monkeypatch):
    monkeypatch.setattr(ocr_service, "_OCR_PROVIDER", "cloud_vision")
    monkeypatch.setattr(
        ocr_service,
        "classify_pages",
        lambda *_args, **_kwargs: {
            OcrRoute.PADDLE_SIMPLE.value: [(0, object())],
            OcrRoute.GEMINI_FLASH.value: [(1, object())],
            OcrRoute.GEMINI_BATCH.value: [],
        },
    )
    monkeypatch.setattr(ocr_service, "is_paddle_worker_alive", lambda: pytest.fail("PaddleOCR should not be used"))

    async def fake_cloud_vision(pdf_bytes, document_id, page_indices):
        assert pdf_bytes == b"pdf"
        assert document_id == "doc-1"
        assert page_indices == [0, 1]
        return [{"id": "blk_vision_0_0", "page_index": 0}]

    monkeypatch.setattr(ocr_service, "ocr_pages_with_cloud_vision", fake_cloud_vision)

    blocks = await ocr_service.ocr_document(b"pdf", "doc-1", [0, 1])

    assert blocks == [{"id": "blk_vision_0_0", "page_index": 0}]
