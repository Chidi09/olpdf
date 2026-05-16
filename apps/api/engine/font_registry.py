import hashlib
import io
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

import fitz
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

from ..core.storage_client import r2_storage
from ..core.supabase_client import supabase

logger = logging.getLogger(__name__)


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


def extract_embedded_font(pdf_bytes: bytes, font_name: str) -> Optional[bytes]:
    if not pdf_bytes or not font_name:
        return None

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        logger.warning("Failed to open PDF for font extraction", exc_info=True)
        return None

    try:
        seen_xrefs: set[int] = set()
        for page in doc:
            for f in page.get_fonts(full=True):
                if not f:
                    continue
                xref: int = f[0]
                if xref in seen_xrefs:
                    continue
                seen_xrefs.add(xref)

                base_font = str(f[3]) if len(f) > 3 else ""
                if font_name.lower() not in base_font.lower() and base_font.lower() not in font_name.lower():
                    continue

                try:
                    result = doc.extract_font(xref)
                    if result is None:
                        continue
                    font_bytes, ext = result
                    ext_lower = ext.lower() if ext else ""
                    if ext_lower in ("ttf", "otf", "woff", "woff2"):
                        return font_bytes
                    logger.debug("Font %s has non-subsettable type: %s", font_name, ext)
                    return None
                except Exception:
                    logger.debug("Failed to extract font xref %d for %s", xref, font_name, exc_info=True)
                    continue
        return None
    finally:
        doc.close()


def get_or_create_font_subset(
    document_id: str,
    pdf_font_name: str,
    characters: set[str],
    pdf_bytes: Optional[bytes] = None,
) -> Optional[str]:
    if not document_id or not pdf_font_name or not characters:
        return None

    char_hash = hashlib.sha256("".join(sorted(characters)).encode()).hexdigest()

    try:
        existing = (
            supabase.table("fidelity_font_registry")
            .select("subset_url")
            .eq("document_id", document_id)
            .eq("pdf_font_name", pdf_font_name)
            .eq("character_hash", char_hash)
            .limit(1)
            .execute()
        )
        if existing.data:
            subset_url = existing.data[0].get("subset_url")
            if subset_url:
                return subset_url
    except Exception:
        pass

    source = "proxy"
    font_bytes_for_subset: Optional[bytes] = None
    ttf_path: Optional[str] = None

    if pdf_bytes:
        embedded = extract_embedded_font(pdf_bytes, pdf_font_name)
        if embedded is not None:
            source = "embedded"
            font_bytes_for_subset = embedded

    if font_bytes_for_subset is None:
        ttf_path = _resolve_ttf_path(pdf_font_name)
        if not ttf_path:
            return None
        with open(ttf_path, "rb") as f:
            font_bytes_for_subset = f.read()

    safe_name = _sanitize_font_name(pdf_font_name)
    object_name = f"fonts/{document_id}/{safe_name}_subset.ttf"

    with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as tmp_file:
        subset_path = tmp_file.name

    try:
        font = TTFont(io.BytesIO(font_bytes_for_subset))
        options = Options()
        options.set(layout_features="*")
        subsetter = Subsetter(options=options)
        subsetter.populate(text="".join(sorted(characters)))
        try:
            subsetter.subset(font)
        except Exception:
            logger.warning(
                "Subsetting failed for font %s (source=%s), falling back to proxy",
                pdf_font_name,
                source,
            )
            ttf_path = _resolve_ttf_path(pdf_font_name)
            if not ttf_path:
                return None
            with open(ttf_path, "rb") as f:
                font_bytes_for_subset = f.read()
            font = TTFont(io.BytesIO(font_bytes_for_subset))
            subsetter = Subsetter(options=options)
            subsetter.populate(text="".join(sorted(characters)))
            subsetter.subset(font)
            source = "proxy"

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
                "source": source,
                "character_hash": char_hash,
            }).execute()
        except Exception:
            pass

        return subset_url
    finally:
        try:
            os.remove(subset_path)
        except OSError:
            pass
