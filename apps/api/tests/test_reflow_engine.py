from apps.api.reflow_engine import reflow_document


def test_reflow_preserves_page_when_space_available():
    model = {
        "meta": {"layout_mode": "fidelity"},
        "page_dimensions": [{"page_index": 0, "width": 595.28, "height": 841.89}],
        "blocks": [
            {
                "id": "b1",
                "type": "paragraph",
                "content": "short text",
                "font_meta": {"size": 11},
                "page_index": 0,
                "bounding_box": [72, 100, 523, 120],
            }
        ],
    }

    out = reflow_document(model)
    assert len(out["blocks"]) == 1
    assert out["blocks"][0]["page_index"] == 0
    assert out["blocks"][0]["bounding_box"][1] >= 100


def test_reflow_moves_overflow_to_next_page():
    long_text = "word " * 110
    model = {
        "meta": {"layout_mode": "fidelity"},
        "page_dimensions": [{"page_index": 0, "width": 595.28, "height": 300.0}],
        "blocks": [
            {
                "id": "b1",
                "type": "paragraph",
                "content": long_text,
                "font_meta": {"size": 11},
                "page_index": 0,
                "bounding_box": [72, 170, 523, 184],
            }
        ],
    }

    out = reflow_document(model)
    assert out["blocks"][0]["page_index"] == 1
    assert any(dim["page_index"] == 1 for dim in out["page_dimensions"])
