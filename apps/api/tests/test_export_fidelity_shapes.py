import fitz

from apps.api.export_utils import export_fidelity


def test_export_fidelity_renders_shape_drawings():
    model = {
        "id": "7f9d8d6d-9dc4-4c87-a0ef-5f9a2ea03d41",
        "meta": {"layout_mode": "fidelity"},
        "page_dimensions": [{"page_index": 0, "width": 595.28, "height": 841.89}],
        "blocks": [
            {
                "id": "txt_1",
                "type": "paragraph",
                "content": "Hello shape layer",
                "font_meta": {"family": "Helvetica", "size": 12, "color": "#111111"},
                "page_index": 0,
                "z_index": 0,
                "bounding_box": [72, 80, 280, 100],
            },
            {
                "id": "shape_1",
                "type": "shape",
                "content": "",
                "page_index": 0,
                "z_index": 1,
                "bounding_box": [100, 160, 260, 250],
                "fabric_data": {
                    "type": "rounded-rect",
                    "stroke": "#0f172a",
                    "fill": "#e2e8f0",
                    "strokeWidth": 2,
                    "rx": 16,
                    "ry": 16,
                },
            },
            {
                "id": "shape_2",
                "type": "shape",
                "content": "",
                "page_index": 0,
                "z_index": 2,
                "bounding_box": [100, 300, 280, 360],
                "fabric_data": {
                    "type": "arrow",
                    "stroke": "#dc2626",
                    "strokeWidth": 2,
                    "x2": 300,
                    "y2": 360,
                    "arrowHeadLength": 14,
                    "arrowHeadAngle": 30,
                },
            },
        ],
    }

    pdf_bytes = export_fidelity(model)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 100

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    assert len(doc) == 1
    page = doc[0]
    drawings = page.get_drawings()
    text = page.get_text("text")
    doc.close()

    assert len(drawings) >= 2
    assert "Hello shape layer" in text
