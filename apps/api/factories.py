from typing import Dict, Callable
from .engine.exporter import (
    export_pdfa,
    export_tagged_pdf,
    export_fidelity,
    export_epub,
    export_html,
    export_markdown,
    export_text,
    compile_book_to_pdf,
    compile_book_to_epub,
)


class ExportEngineFactory:
    _engines: Dict[str, Callable] = {
        "pdf_a": export_pdfa,
        "tagged": export_tagged_pdf,
        "fidelity": export_fidelity,
        "standard": export_pdfa,
        "epub": export_epub,
        "html": export_html,
        "markdown": export_markdown,
        "txt": export_text,
    }

    @classmethod
    def get_engine(cls, format_type: str) -> Callable:
        return cls._engines.get(format_type, export_pdfa)


class BookExportFactory:
    _engines: Dict[str, Callable] = {
        "pdf": compile_book_to_pdf,
        "epub": compile_book_to_epub,
    }

    @classmethod
    def get_engine(cls, format_type: str) -> Callable:
        return cls._engines.get(format_type, compile_book_to_pdf)
