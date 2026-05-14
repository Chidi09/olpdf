from apps.api.worker_utils import merge_import_model


def test_merge_import_model_preserves_native_session():
    existing_model = {
        "meta": {
            "title": "PDF Doc",
            "native_pdf": True,
            "original_pdf_key": "documents/doc-1.pdf",
            "native_pdf_session": {"documentId": "doc-1", "objects": [{"id": "obj-1"}], "operations": []},
            "layout_mode": "fidelity",
        },
        "blocks": [],
        "page_dimensions": [],
    }
    extracted_model = {"blocks": [{"id": "blk_1", "content": "extracted text"}], "page_dimensions": [{"page_index": 0, "width": 612, "height": 792}]}

    merged = merge_import_model(existing_model, extracted_model, final_status="ready")
    assert merged["meta"]["native_pdf_session"]["objects"][0]["id"] == "obj-1"
    assert merged["meta"]["import_status"] == "ready"
    assert merged["blocks"][0]["id"] == "blk_1"
    assert len(merged["page_dimensions"]) == 1


def test_merge_import_model_fallback_no_extracted():
    existing_model = {
        "meta": {"native_pdf": True, "original_pdf_key": "documents/doc-1.pdf", "native_pdf_session": {"objects": []}},
        "blocks": [{"id": "blk_0", "content": "existing"}],
        "page_dimensions": [],
    }
    merged = merge_import_model(existing_model, None, final_status="partial")
    assert merged["meta"]["import_status"] == "partial"
    assert merged["blocks"][0]["content"] == "existing"


def test_merge_import_model_no_existing_meta():
    existing_model = {"meta": {}, "blocks": [], "page_dimensions": []}
    extracted_model = {"blocks": [{"id": "blk_1"}], "page_dimensions": [{"page_index": 0, "width": 612, "height": 792}]}
    merged = merge_import_model(existing_model, extracted_model, final_status="ready")
    assert merged["meta"]["import_status"] == "ready"
    assert merged["blocks"][0]["id"] == "blk_1"
