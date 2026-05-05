from typing import Dict, Any, Callable
from .export_utils import export_pdfa, export_tagged_pdf, compile_book_to_pdf, compile_book_to_epub

class ExportEngineFactory:
    _engines: Dict[str, Callable] = {
        "pdf_a": export_pdfa,
        "tagged": export_tagged_pdf,
        "standard": export_pdfa, # Default fallback
    }

    @classmethod
    def get_engine(cls, format_type: str) -> Callable:
        return cls._engines.get(format_type, export_pdfa)

class BookExportFactory:
    _engines: Dict[str, Callable] = {
        "pdf": compile_book_to_pdf,
        "epub": compile_book_to_epub
    }

    @classmethod
    def get_engine(cls, format_type: str) -> Callable:
        return cls._engines.get(format_type, compile_book_to_pdf)
