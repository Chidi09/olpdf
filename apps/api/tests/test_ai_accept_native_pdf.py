import os

os.environ["SUPABASE_JWT_SECRET"] = "test-secret-for-testing-only"
os.environ["OLPDF_DEV_MODE"] = "true"

from apps.api.services.document_patch import apply_ai_block_patch


def test_preserves_native_pdf_layout_on_ai_accept():
    model = {
        "meta": {
            "title": "Test PDF",
            "native_pdf": True,
            "native_pdf_session": {"documentId": "doc-1", "objects": [], "operations": []},
        },
        "page_dimensions": [{"page_index": 0, "width": 612, "height": 792}],
        "blocks": [
            {
                "id": "blk_1",
                "type": "paragraph",
                "content": "Original text",
                "bounding_box": [72, 100, 500, 130],
                "page_index": 0,
                "z_index": 1,
            },
            {
                "id": "blk_2",
                "type": "paragraph",
                "content": "Second block",
                "bounding_box": [72, 140, 500, 170],
                "page_index": 0,
                "z_index": 2,
            },
        ],
        "styles": {},
    }

    after_blocks = [
        {"id": "blk_1", "content": "AI rewritten text"},
        {"id": "blk_2", "content": "Also updated by AI"},
    ]

    result = apply_ai_block_patch(model, after_blocks)

    # Content should be updated
    assert result["blocks"][0]["content"] == "AI rewritten text"
    assert result["blocks"][1]["content"] == "Also updated by AI"

    # Layout fields must be preserved
    assert result["blocks"][0]["bounding_box"] == [72, 100, 500, 130]
    assert result["blocks"][0]["page_index"] == 0
    assert result["blocks"][0]["z_index"] == 1

    assert result["blocks"][1]["bounding_box"] == [72, 140, 500, 170]
    assert result["blocks"][1]["page_index"] == 0

    # Top-level metadata must survive
    assert result["meta"]["native_pdf"] is True
    assert result["meta"]["native_pdf_session"] is not None
    assert len(result["page_dimensions"]) == 1


def test_preserves_blocks_not_in_after():
    model = {
        "meta": {},
        "page_dimensions": [],
        "blocks": [
            {"id": "blk_1", "type": "paragraph", "content": "Keep me", "bounding_box": [0, 0, 100, 50]},
            {"id": "blk_2", "type": "paragraph", "content": "Update me", "bounding_box": [0, 60, 100, 110]},
        ],
        "styles": {},
    }

    after_blocks = [
        {"id": "blk_2", "content": "Updated"},
    ]

    result = apply_ai_block_patch(model, after_blocks)

    assert len(result["blocks"]) == 2
    assert result["blocks"][0]["content"] == "Keep me"
    assert result["blocks"][1]["content"] == "Updated"
    assert result["blocks"][0]["bounding_box"] == [0, 0, 100, 50]
