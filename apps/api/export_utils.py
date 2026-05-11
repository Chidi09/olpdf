from .engine.exporter import (  # noqa: F401
    export_pdfa,
    export_tagged_pdf,
    export_fidelity,
    compile_book_to_pdf,
    compile_book_to_epub,
    merge_pdfs,
    split_pdf,
    compress_pdf,
    rotate_pages,
    add_watermark,
    protect_pdf,
    extract_images_from_pdf,
    detect_form_fields,
    fill_form_fields,
    run_preflight,
)
from .engine.redaction import apply_true_redaction  # noqa: F401

# backward-compat aliases used by old routes
rotate_pdf = rotate_pages
watermark_pdf = add_watermark
extract_images = extract_images_from_pdf
