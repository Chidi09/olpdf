import pytest

from apps.api.services.google_vision_ocr_client import (
    ocr_pages_with_cloud_vision,
    vision_response_to_blocks,
)


def test_vision_response_to_blocks_uses_paragraphs_and_page_bbox():
    response = {
        "responses": [
            {
                "fullTextAnnotation": {
                    "pages": [
                        {
                            "width": 1000,
                            "height": 2000,
                            "blocks": [
                                {
                                    "paragraphs": [
                                        {
                                            "confidence": 0.91,
                                            "boundingBox": {
                                                "normalizedVertices": [
                                                    {"x": 0.1, "y": 0.2},
                                                    {"x": 0.4, "y": 0.2},
                                                    {"x": 0.4, "y": 0.3},
                                                    {"x": 0.1, "y": 0.3},
                                                ]
                                            },
                                            "words": [
                                                {
                                                    "symbols": [
                                                        {"text": "H"},
                                                        {"text": "i"},
                                                    ],
                                                    "property": {
                                                        "detectedBreak": {"type": "SPACE"}
                                                    },
                                                },
                                                {
                                                    "symbols": [
                                                        {"text": "t"},
                                                        {"text": "h"},
                                                        {"text": "e"},
                                                        {"text": "r"},
                                                        {"text": "e"},
                                                    ]
                                                },
                                            ],
                                        }
                                    ]
                                }
                            ],
                        }
                    ]
                }
            }
        ]
    }

    blocks = vision_response_to_blocks(response, page_index=2)

    assert blocks == [
        {
            "id": "blk_vision_2_0",
            "type": "paragraph",
            "content": "Hi there",
            "rich_spans": [],
            "page_index": 2,
            "bounding_box": [100.0, 400.0, 300.0, 200.0],
            "confidence_score": 0.91,
            "needs_review": False,
            "style_overrides": {},
            "float": "none",
            "column_index": 0,
        }
    ]


@pytest.mark.asyncio
async def test_ocr_pages_with_cloud_vision_posts_document_text_detection(monkeypatch):
    calls = []

    monkeypatch.setenv("GOOGLE_CLOUD_VISION_API_KEY", "test-key")
    monkeypatch.setattr(
        "apps.api.services.google_vision_ocr_client._render_page_png",
        lambda _pdf_bytes, _page_index: b"png-bytes",
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "responses": [
                    {
                        "fullTextAnnotation": {
                            "pages": [
                                {
                                    "width": 10,
                                    "height": 10,
                                    "blocks": [],
                                }
                            ]
                        }
                    }
                ]
            }

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_exc):
            return False

        async def post(self, url, json):
            calls.append((url, json))
            return FakeResponse()

    monkeypatch.setattr("apps.api.services.google_vision_ocr_client.httpx.AsyncClient", FakeClient)

    blocks = await ocr_pages_with_cloud_vision(b"pdf", "doc-1", [3])

    assert blocks == []
    assert calls[0][0].endswith("/v1/images:annotate?key=test-key")
    assert calls[0][1]["requests"][0]["features"] == [{"type": "DOCUMENT_TEXT_DETECTION"}]
    assert calls[0][1]["requests"][0]["image"]["content"]
