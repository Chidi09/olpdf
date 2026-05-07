import pytest
import io
from apps.api.export_utils import export_fidelity

def test_export_fidelity_with_images_and_shapes():
    # Construct a document model with various blocks
    doc_model = {
        "id": "test-doc-123",
        "meta": {
            "title": "Fidelity Test",
            "author": "Tester"
        },
        "page_dimensions": [
            {"page_index": 0, "width": 595.28, "height": 841.89}
        ],
        "blocks": [
            {
                "id": "blk1",
                "type": "text",
                "content": "Hello World",
                "bounding_box": [100, 100, 200, 120],
                "font_meta": {"family": "Helvetica", "size": 12, "color": "#ff0000"},
                "page_index": 0,
                "z_index": 1
            },
            {
                "id": "img1",
                "type": "image",
                "content": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", # 1x1 red dot
                "bounding_box": [100, 200, 150, 250],
                "page_index": 0,
                "z_index": 2
            },
            {
                "id": "shp1",
                "type": "shape",
                "fabric_data": {
                    "type": "rect",
                    "stroke": "#0000ff",
                    "fill": "#00ff00",
                    "rx": 5,
                    "ry": 5,
                    "strokeWidth": 2
                },
                "bounding_box": [100, 300, 200, 350],
                "page_index": 0,
                "z_index": 0 # Should be drawn first
            },
            {
                "id": "path1",
                "type": "shape",
                "fabric_data": {
                    "type": "path",
                    "path": [["M", 10, 10], ["L", 50, 50], ["Z"]],
                    "stroke": "#000000",
                    "strokeWidth": 1
                },
                "bounding_box": [10, 10, 50, 50],
                "page_index": 0,
                "z_index": 3
            }
        ]
    }
    
    pdf_bytes = export_fidelity(doc_model)
    assert len(pdf_bytes) > 0
    assert pdf_bytes.startswith(b"%PDF")

def test_export_fidelity_empty():
    doc_model = {
        "blocks": [],
        "page_dimensions": []
    }
    pdf_bytes = export_fidelity(doc_model)
    assert len(pdf_bytes) > 0
    assert pdf_bytes.startswith(b"%PDF")
