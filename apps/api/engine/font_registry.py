import os
import tempfile
from pathlib import Path
from typing import Optional

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

from ..core.storage_client import r2_storage
from ..core.supabase_client import supabase


FONT_TTF_MAP = {
    "TimesNewRoman": "fonts/LiberationSerif-Regular.ttf",
    "TimesNewRoman,Bold": "fonts/LiberationSerif-Bold.ttf",
    "Arial": "fonts/LiberationSans-Regular.ttf",
    "Arial,Bold": "fonts/LiberationSans-Bold.ttf",
}


def _sanitize_font_name(font_name: str) -> str:
    return "".join(ch for ch in font_name if ch.isalnum() or ch in ("-", "_", ","))


def _resolve_ttf_path(pdf_font_name: str) -> Optional[str]:
    configured_dir = os.environ.get("FONT_DIR", "fonts")
    mapped = FONT_TTF_MAP.get(pdf_font_name)
    if mapped and os.path.exists(mapped):
        return mapped
    fallback = Path(configured_dir) / f"{pdf_font_name}.ttf"
    if fallback.exists():
        return str(fallback)
    return None


def get_or_create_font_subset(document_id: str, pdf_font_name: str, characters: set[str]) -> Optional[str]:
    if not document_id or not pdf_font_name or not characters:
        return None

    try:
        existing = (
            supabase.table("fidelity_font_registry")
            .select("subset_url")
            .eq("document_id", document_id)
            .eq("pdf_font_name", pdf_font_name)
            .limit(1)
            .execute()
        )
        if existing.data:
            subset_url = existing.data[0].get("subset_url")
            if subset_url:
                return subset_url
    except Exception:
        pass

    ttf_path = _resolve_ttf_path(pdf_font_name)
    if not ttf_path:
        return None

    safe_name = _sanitize_font_name(pdf_font_name)
    object_name = f"fonts/{document_id}/{safe_name}_subset.ttf"

    with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as tmp_file:
        subset_path = tmp_file.name

    try:
        font = TTFont(ttf_path)
        options = Options()
        options.set(layout_features="*")
        subsetter = Subsetter(options=options)
        subsetter.populate(text="".join(sorted(characters)))
        subsetter.subset(font)
        font.save(subset_path)

        with open(subset_path, "rb") as font_file:
            subset_bytes = font_file.read()

        subset_url = r2_storage.upload_bytes(subset_bytes, object_name)
        if not subset_url:
            return None

        try:
            supabase.table("fidelity_font_registry").insert({
                "document_id": document_id,
                "pdf_font_name": pdf_font_name,
                "ttf_path": ttf_path,
                "subset_url": subset_url,
            }).execute()
        except Exception:
            pass

        return subset_url
    finally:
        try:
            os.remove(subset_path)
        except OSError:
            pass
