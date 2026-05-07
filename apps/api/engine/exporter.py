"""
PDF / EPUB export pipeline.  All ReportLab and PyMuPDF rendering lives here.
This module is the open-sourceable core engine — keep it free of HTTP concerns.
"""
import base64
import io
import math
import os
import re
import tempfile
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

import fitz
from ebooklib import epub
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from ..core.storage_client import r2_storage


# ── Color helpers ─────────────────────────────────────────────────────────────

def _hex_to_rgb(color: str) -> tuple[float, float, float]:
    raw = (color or "#000000").strip()
    if not raw.startswith("#"):
        raw = f"#{raw}"
    if len(raw) == 4:
        raw = f"#{raw[1]*2}{raw[2]*2}{raw[3]*2}"
    if len(raw) != 7:
        raw = "#000000"
    try:
        r = int(raw[1:3], 16) / 255.0
        g = int(raw[3:5], 16) / 255.0
        b = int(raw[5:7], 16) / 255.0
    except ValueError:
        return (0.0, 0.0, 0.0)
    return (r, g, b)


def _hex_to_cmyk(color: str) -> tuple[float, float, float, float]:
    r, g, b = _hex_to_rgb(color)
    k = 1 - max(r, g, b)
    if k == 1:
        return (0.0, 0.0, 0.0, 1.0)
    c = (1 - r - k) / (1 - k)
    m = (1 - g - k) / (1 - k)
    y = (1 - b - k) / (1 - k)
    return (round(c, 3), round(m, 3), round(y, 3), round(k, 3))


# ── Font helpers ──────────────────────────────────────────────────────────────

FONT_TTF_MAP = {
    "TimesNewRoman": "fonts/LiberationSerif-Regular.ttf",
    "TimesNewRoman,Bold": "fonts/LiberationSerif-Bold.ttf",
    "Arial": "fonts/LiberationSans-Regular.ttf",
    "Arial,Bold": "fonts/LiberationSans-Bold.ttf",
    "Helvetica": None,
    "Helvetica-Bold": None,
    "Courier": None,
}
FONT_FILE_OVERRIDES: dict[str, str] = {}


def _font_family_to_reportlab_name(family: str, is_bold: bool, is_italic: bool) -> str:
    base = (family or "Helvetica").strip() or "Helvetica"
    if base == "Unknown":
        base = "Helvetica"
    if base == "Helvetica" and is_bold:
        return "Helvetica-Bold"
    if base in ("TimesNewRoman", "Arial") and is_bold:
        return f"{base},Bold"
    if is_italic and base == "Helvetica":
        return "Helvetica-Oblique"
    return base


def _register_font_if_needed(family: str) -> str:
    fallback = "Helvetica"
    if family in pdfmetrics.getRegisteredFontNames() or family in (
        "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Courier"
    ):
        return family
    ttf_path = FONT_FILE_OVERRIDES.get(family) or FONT_TTF_MAP.get(family)
    if not ttf_path or not os.path.exists(ttf_path):
        return fallback
    try:
        pdfmetrics.registerFont(TTFont(family, ttf_path))
        return family
    except Exception:
        return fallback


def _extract_r2_object_name(url: str) -> Optional[str]:
    bucket_name = os.getenv("R2_BUCKET_NAME", "olpdf-documents")
    marker = f"/{bucket_name}/"
    if marker in url:
        return url.split(marker, 1)[1]
    return None


def _register_subset_font_if_available(family: str, subset_url: str) -> None:
    object_name = _extract_r2_object_name(subset_url)
    if not object_name:
        return
    subset_bytes = r2_storage.download_bytes(object_name)
    if not subset_bytes:
        return
    with tempfile.NamedTemporaryFile(suffix=".ttf", delete=False) as tmp:
        tmp.write(subset_bytes)
        FONT_FILE_OVERRIDES[family] = tmp.name


# ── ReportLab shared helpers ──────────────────────────────────────────────────

def inject_pdfa_metadata(c, doc) -> None:
    c.setAuthor(doc.author)
    c.setTitle(doc.title)
    c.setSubject("OLPDF Export")
    c.setCreator("OLPDF v1.0")


def build_reportlab_styles(styles_config: Dict[str, Any]) -> Dict[str, ParagraphStyle]:
    styles = getSampleStyleSheet()
    return {
        "heading1": ParagraphStyle("Heading1", parent=styles["Heading1"], fontSize=24, leading=30, spaceAfter=12),
        "heading2": ParagraphStyle("Heading2", parent=styles["Heading2"], fontSize=18, leading=22, spaceAfter=10),
        "heading3": ParagraphStyle("Heading3", parent=styles["Heading3"], fontSize=14, leading=18, spaceAfter=8),
        "paragraph": ParagraphStyle("BodyText", parent=styles["BodyText"], fontSize=11, leading=16, spaceAfter=8),
        "callout": ParagraphStyle("Callout", parent=styles["BodyText"], fontSize=11, leading=16, leftIndent=20, rightIndent=20, fontName="Helvetica-Oblique"),
    }


def compile_block(block: Dict[str, Any], styles: Dict[str, Any]) -> List:
    btype = block.get("type")
    content = block.get("content", "")

    if btype in ("heading1", "heading2", "heading3", "paragraph", "callout", "text"):
        style_key = btype if btype != "text" else "paragraph"
        return [Paragraph(content, styles.get(style_key, styles["paragraph"])), Spacer(1, 6)]

    if btype == "table":
        headers = block.get("headers", [])
        rows = block.get("rows", [])
        data = [headers] + rows
        if not data or not data[0]:
            return []
        t = Table(data, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("PADDING", (0, 0), (-1, -1), 8),
        ]))
        return [t, Spacer(1, 12)]

    if btype == "page_break":
        return [PageBreak()]

    if btype == "divider":
        from reportlab.platypus import HRFlowable
        return [HRFlowable(width="100%", thickness=1, color=colors.lightgrey), Spacer(1, 8)]

    return []


# ── Preflight ─────────────────────────────────────────────────────────────────

def run_preflight(document_model: Dict[str, Any]) -> List[Dict[str, Any]]:
    issues = []
    blocks = document_model.get("blocks", [])
    meta = document_model.get("meta", {})

    for block in blocks:
        content = block.get("content", "")
        if not isinstance(content, str):
            continue
        placeholders = re.findall(r"\{\{[A-Z_]+\}\}", content)
        if placeholders:
            issues.append({
                "type": "unresolved_placeholder",
                "block_id": block.get("id"),
                "detail": f"Contains unresolved: {', '.join(placeholders)}",
                "severity": "warning",
            })

    for block in blocks:
        if block.get("type") == "image" and not block.get("alt_text"):
            issues.append({
                "type": "missing_alt_text",
                "block_id": block.get("id"),
                "detail": "Image block has no alt text — required for PDF/UA",
                "severity": "error" if meta.get("export_standard") == "tagged" else "warning",
            })

    for i in range(len(blocks) - 1):
        if blocks[i].get("type") == "heading1" and blocks[i + 1].get("type") == "heading3":
            issues.append({
                "type": "orphaned_heading",
                "block_id": blocks[i + 1].get("id"),
                "detail": "H3 directly after H1 — missing H2",
                "severity": "warning",
            })

    low_confidence = [b for b in blocks if b.get("needs_review")]
    if low_confidence:
        issues.append({
            "type": "unreviewed_ocr_blocks",
            "count": len(low_confidence),
            "block_ids": [b.get("id") for b in low_confidence],
            "detail": f"{len(low_confidence)} blocks extracted with low confidence",
            "severity": "warning",
        })

    return issues


# ── ReportLab exports ─────────────────────────────────────────────────────────

def export_pdfa(document_model: Dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    meta = document_model.get("meta", {})
    font_path = "fonts/Lora-Regular.ttf"
    if os.path.exists(font_path):
        pdfmetrics.registerFont(TTFont("Lora", font_path))

    doc = SimpleDocTemplate(buffer, pagesize=A4, title=meta.get("title", "Untitled"), author=meta.get("author", "OLPDF User"))
    styles = build_reportlab_styles(document_model.get("styles", {}))
    story = [item for block in document_model.get("blocks", []) for item in compile_block(block, styles)]
    doc.build(story, onFirstPage=inject_pdfa_metadata, onLaterPages=inject_pdfa_metadata)
    return buffer.getvalue()


def export_tagged_pdf(document_model: Dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    meta = document_model.get("meta", {})
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=meta.get("title", "Tagged Document"), author=meta.get("author", "OLPDF"), subject="Accessible PDF Export", creator="OLPDF v1.0")
    styles = build_reportlab_styles(document_model.get("styles", {}))

    def on_page(canv, doc):
        inject_pdfa_metadata(canv, doc)
        try:
            canv._doc.info["Lang"] = "en"
        except Exception:
            pass

    story = [item for block in document_model.get("blocks", []) for item in compile_block(block, styles)]
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buffer.getvalue()


# ── Fidelity (pixel-perfect) export ──────────────────────────────────────────

def _draw_image_block(c: canvas.Canvas, block: Dict[str, Any], page_height: float) -> None:
    fabric_data = block.get("fabric_data") or {}
    src = fabric_data.get("src") or block.get("content")
    if not src:
        return
    bbox = block.get("bounding_box") or []
    if not (isinstance(bbox, list) and len(bbox) == 4):
        return
    x0, top, x1, bottom = [float(v) for v in bbox]
    width = max(x1 - x0, 1.0)
    height = max(bottom - top, 1.0)
    rl_y = float(page_height) - float(bottom)
    try:
        if isinstance(src, str) and src.startswith("data:image"):
            _, encoded = src.split(",", 1)
            img_reader = ImageReader(io.BytesIO(base64.b64decode(encoded)))
            c.drawImage(img_reader, x0, rl_y, width=width, height=height, mask="auto")
        elif isinstance(src, str) and src.startswith("http"):
            object_name = _extract_r2_object_name(src)
            if object_name:
                img_bytes = r2_storage.download_bytes(object_name)
                if img_bytes:
                    c.drawImage(ImageReader(io.BytesIO(img_bytes)), x0, rl_y, width=width, height=height, mask="auto")
    except Exception:
        pass


def _draw_fidelity_block(c: canvas.Canvas, block: Dict[str, Any], page_height: float, color_space: str = "rgb") -> None:
    btype = block.get("type")
    if btype == "image":
        _draw_image_block(c, block, page_height)
        return
    if btype in {"table", "shape"}:
        return

    content = (block.get("content") or "").strip()
    if not content:
        return

    bbox = block.get("bounding_box") or []
    if not (isinstance(bbox, list) and len(bbox) == 4):
        c.setFont("Helvetica", 11)
        if color_space == "cmyk":
            c.setFillColorCMYK(0, 0, 0, 1)
        else:
            c.setFillColorRGB(0.0, 0.0, 0.0)
        c.drawString(72.0, 72.0, content)
        return

    x0, top, x1, _ = [float(v) for v in bbox]
    bbox_width = max(x1 - x0, 1.0)
    font_meta = block.get("font_meta") or {}
    size = float(font_meta.get("size", 11.0) or 11.0)
    family = _font_family_to_reportlab_name(
        str(font_meta.get("family", "Helvetica")),
        bool(font_meta.get("is_bold", False)),
        bool(font_meta.get("is_italic", False)),
    )
    rl_font = _register_font_if_needed(family)
    hex_color = str(font_meta.get("color", "#000000"))
    c.setFont(rl_font, max(size, 1.0))
    if color_space == "cmyk":
        c.setFillColorCMYK(*_hex_to_cmyk(hex_color))
    else:
        c.setFillColorRGB(*_hex_to_rgb(hex_color))

    rl_y = float(page_height) - float(top)
    if c.stringWidth(content, rl_font, size) <= bbox_width:
        c.drawString(float(x0), rl_y, content)
        return

    line_height = max(size * 1.2, 1.0)
    current_line = ""
    line_idx = 0
    for word in content.split():
        candidate = word if not current_line else f"{current_line} {word}"
        if c.stringWidth(candidate, rl_font, size) <= bbox_width:
            current_line = candidate
        else:
            if current_line:
                c.drawString(float(x0), rl_y - (line_idx * line_height), current_line)
                line_idx += 1
            current_line = word
    if current_line:
        c.drawString(float(x0), rl_y - (line_idx * line_height), current_line)


def _fitz_color_from_hex(color: str) -> tuple[float, float, float]:
    return _hex_to_rgb(color)


def _draw_shape_block(page: fitz.Page, block: Dict[str, Any]) -> None:
    fabric_data = block.get("fabric_data") or {}
    shape_type = str(fabric_data.get("type") or "").lower()
    bbox = block.get("bounding_box") or [72, 72, 180, 140]
    x0, y0, x1, y1 = [float(v) for v in bbox]
    stroke = _fitz_color_from_hex(str(fabric_data.get("stroke") or "#111111"))
    fill_value = fabric_data.get("fill")
    fill = _fitz_color_from_hex(str(fill_value)) if isinstance(fill_value, str) and fill_value not in {"transparent", ""} else None
    stroke_width = float(fabric_data.get("strokeWidth") or 1.0)

    if shape_type in {"rect", "rectangle", "rounded-rect", "rounded_rect"}:
        rect = fitz.Rect(x0, y0, x1, y1)
        radius = float(fabric_data.get("rx") or fabric_data.get("ry") or 0)
        if radius > 0:
            try:
                shape = page.new_shape()
                shape.draw_rect(rect, radius=radius)
                shape.finish(color=stroke, fill=fill, width=stroke_width)
                shape.commit()
            except Exception:
                page.draw_rect(rect, color=stroke, fill=fill, width=stroke_width)
        else:
            page.draw_rect(rect, color=stroke, fill=fill, width=stroke_width)
        return

    if shape_type in {"ellipse", "circle"}:
        page.draw_oval(fitz.Rect(x0, y0, x1, y1), color=stroke, fill=fill, width=stroke_width)
        return

    if shape_type in {"line", "arrow"}:
        x2 = float(fabric_data.get("x2", x1))
        y2 = float(fabric_data.get("y2", y1))
        p0, p1 = fitz.Point(x0, y0), fitz.Point(x2, y2)
        page.draw_line(p0, p1, color=stroke, width=stroke_width)
        if shape_type == "arrow":
            angle = math.atan2(y2 - y0, x2 - x0)
            arrow_len = max(float(fabric_data.get("arrowHeadLength") or 12.0), 6.0)
            spread = math.radians(float(fabric_data.get("arrowHeadAngle") or 28.0))
            page.draw_line(p1, fitz.Point(x2 - arrow_len * math.cos(angle - spread), y2 - arrow_len * math.sin(angle - spread)), color=stroke, width=stroke_width)
            page.draw_line(p1, fitz.Point(x2 - arrow_len * math.cos(angle + spread), y2 - arrow_len * math.sin(angle + spread)), color=stroke, width=stroke_width)
        return

    if shape_type in {"textbox", "text", "i-text"}:
        text = str(fabric_data.get("text") or block.get("content") or "")
        page.insert_text(fitz.Point(x0, y1), text, fontsize=float(fabric_data.get("fontSize") or 12), color=stroke)
        return

    if shape_type in {"sticky-note", "sticky_note"}:
        rect = fitz.Rect(x0, y0, x1, y1)
        note_fill = _fitz_color_from_hex(str(fabric_data.get("noteFill") or "#fff59d"))
        text_color = _fitz_color_from_hex(str(fabric_data.get("textColor") or "#3f3f46"))
        page.draw_rect(rect, color=stroke, fill=note_fill, width=stroke_width)
        text = str(fabric_data.get("text") or block.get("content") or "")
        if text:
            page.insert_textbox(rect, text, fontsize=float(fabric_data.get("fontSize") or 12), color=text_color)
        return

    if shape_type in {"path", "polyline"}:
        path_data = fabric_data.get("path")
        if isinstance(path_data, list):
            shape = page.new_shape()
            points: List[fitz.Point] = []
            for cmd_list in path_data:
                if not isinstance(cmd_list, list) or not cmd_list:
                    continue
                op = str(cmd_list[0]).upper()
                try:
                    if op == "M" and len(cmd_list) >= 3:
                        if points:
                            shape.draw_polyline(points)
                            points = []
                        points.append(fitz.Point(float(cmd_list[1]), float(cmd_list[2])))
                    elif op == "L" and len(cmd_list) >= 3:
                        points.append(fitz.Point(float(cmd_list[1]), float(cmd_list[2])))
                    elif op == "Z" and points:
                        points.append(points[0])
                        shape.draw_polyline(points)
                        points = []
                except (ValueError, IndexError):
                    continue
            if points:
                shape.draw_polyline(points)
            shape.finish(color=stroke, fill=fill, width=stroke_width)
            shape.commit()


def _render_shapes_with_pymupdf(pdf_bytes: bytes, shape_blocks_by_page: Dict[int, list]) -> bytes:
    if not shape_blocks_by_page:
        return pdf_bytes
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page_idx, shape_blocks in shape_blocks_by_page.items():
        if 0 <= page_idx < len(doc):
            for block in sorted(shape_blocks, key=lambda b: int(b.get("z_index", 0))):
                _draw_shape_block(doc[page_idx], block)
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    return out.getvalue()


def export_fidelity(document_model: Dict[str, Any], color_space: str = "rgb") -> bytes:
    buffer = io.BytesIO()
    page_dims = {
        int(dim.get("page_index", 0)): {"width": float(dim.get("width", 595.28)), "height": float(dim.get("height", 841.89))}
        for dim in (document_model.get("page_dimensions") or [])
        if isinstance(dim, dict)
    }
    blocks = document_model.get("blocks") or []
    meta = document_model.get("meta") or {}
    document_id = str(document_model.get("id") or "")
    shape_blocks_by_page: Dict[int, list] = defaultdict(list)

    if document_id:
        try:
            from .font_registry import get_or_create_font_subset
            chars_by_family: dict[str, set[str]] = defaultdict(set)
            for block in blocks:
                if not isinstance(block, dict):
                    continue
                text = str(block.get("content") or "")
                family = str((block.get("font_meta") or {}).get("family") or "").strip()
                if text and family:
                    chars_by_family[family].update(set(text))
            for family, chars in chars_by_family.items():
                subset_url = get_or_create_font_subset(document_id, family, chars)
                if subset_url:
                    _register_subset_font_if_available(family, subset_url)
        except Exception:
            pass

    page_blocks: dict[int, list] = defaultdict(list)
    for block in blocks:
        if not isinstance(block, dict):
            continue
        pi = int(block.get("page_index", 0))
        if block.get("type") == "shape":
            shape_blocks_by_page[pi].append(block)
        page_blocks[pi].append(block)

    if not page_blocks:
        c = canvas.Canvas(buffer, pagesize=A4)
        c.save()
        return buffer.getvalue()

    for pi in page_blocks:
        page_blocks[pi].sort(key=lambda b: int(b.get("z_index", 0)))

    page_indices = sorted(page_blocks.keys())
    first_dim = page_dims.get(page_indices[0], {"width": 595.28, "height": 841.89})
    c = canvas.Canvas(buffer, pagesize=(first_dim["width"], first_dim["height"]))
    meta_obj = type("Meta", (), {"title": meta.get("title", "Untitled"), "author": meta.get("author", "OLPDF User")})
    inject_pdfa_metadata(c, meta_obj)

    for i, pi in enumerate(page_indices):
        if i > 0:
            c.showPage()
            inject_pdfa_metadata(c, meta_obj)
            current_dim = page_dims.get(pi, {"width": 595.28, "height": 841.89})
            c.setPageSize((current_dim["width"], current_dim["height"]))
        page_height = page_dims.get(pi, {"height": 841.89})["height"]
        for block in page_blocks.get(pi, []):
            _draw_fidelity_block(c, block, page_height, color_space)

    c.save()
    return _render_shapes_with_pymupdf(buffer.getvalue(), shape_blocks_by_page)


# ── Book exports ──────────────────────────────────────────────────────────────

def compile_book_to_pdf(book_model: Dict[str, Any], chapters: List[Dict[str, Any]]) -> bytes:
    buffer = io.BytesIO()
    book_title = book_model.get("title", "Untitled Book")
    meta = book_model.get("meta", {})
    author = meta.get("author", "OLPDF Author")

    doc = SimpleDocTemplate(buffer, pagesize=A4, title=book_title, author=author)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=28, spaceAfter=30, alignment=1)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=20, spaceAfter=20)
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=11, leading=16)
    toc = ParagraphStyle("TOC", parent=styles["BodyText"], fontSize=12, leading=20)
    copy = ParagraphStyle("Copy", parent=styles["BodyText"], fontSize=9, leading=12, alignment=1)

    story = []
    story += [Spacer(1, 150), Paragraph(book_title, h1)]
    if meta.get("subtitle"):
        story.append(Paragraph(meta["subtitle"], h2))
    story += [Spacer(1, 40), Paragraph(f"By {author}", body), Spacer(1, 20), Paragraph(f"Published by {meta.get('publisher', 'OLPDF')}", body), PageBreak()]
    story += [Spacer(1, 400), Paragraph(f"© {datetime.now().year} {author}. All rights reserved.", copy)]
    if meta.get("isbn"):
        story.append(Paragraph(f"ISBN: {meta['isbn']}", copy))
    story.append(PageBreak())
    story += [Paragraph("Table of Contents", h2), Spacer(1, 12)]
    for ch in chapters:
        story.append(Paragraph(f"Chapter {ch['chapter_number']}: {ch['title']}", toc))
    story.append(PageBreak())

    rl_styles = build_reportlab_styles({})
    for ch in chapters:
        story += [Paragraph(f"Chapter {ch['chapter_number']}", h2), Paragraph(ch["title"], h1), Spacer(1, 24)]
        for block in ch.get("document_model", {}).get("blocks", []):
            story.extend(compile_block(block, rl_styles))
        story.append(PageBreak())

    story += [Paragraph("About the Author", h2), Spacer(1, 12), Paragraph(meta.get("author_bio", f"{author} is a user of OLPDF."), body)]
    doc.build(story)
    return buffer.getvalue()


def compile_book_to_epub(book_model: Dict[str, Any], chapters: List[Dict[str, Any]]) -> bytes:
    book = epub.EpubBook()
    book_title = book_model.get("title", "Untitled Book")
    meta = book_model.get("meta", {})
    author = meta.get("author", "OLPDF Author")

    book.set_identifier(str(uuid.uuid4()))
    book.set_title(book_title)
    book.set_language("en")
    book.add_author(author)

    style = """
@namespace epub "http://www.idpf.org/2007/ops";
body { font-family: "Georgia", serif; margin: 5%; line-height: 1.5; }
h1 { text-align: center; text-transform: uppercase; margin-top: 20%; }
h2 { text-align: left; color: #333; border-bottom: 1px solid #ccc; }
p { text-indent: 1.5em; margin: 0; }
"""
    nav_css = epub.EpubItem(uid="style_nav", file_name="style/nav.css", media_type="text/css", content=style)
    book.add_item(nav_css)

    c_title = epub.EpubHtml(title="Title Page", file_name="title.xhtml")
    c_title.content = f"<div style='text-align:center;margin-top:100px;'><h1>{book_title}</h1><p>By {author}</p></div>"
    book.add_item(c_title)

    c_copy = epub.EpubHtml(title="Copyright", file_name="copyright.xhtml")
    c_copy.content = f"<div style='text-align:center;margin-top:200px;'><p>© {datetime.now().year} {author}</p><p>{meta.get('copyright_notice', 'All rights reserved.')}</p></div>"
    book.add_item(c_copy)

    epub_chapters = [c_title, c_copy]
    for ch_data in chapters:
        c = epub.EpubHtml(title=ch_data["title"], file_name=f"ch_{ch_data['chapter_number']:03d}.xhtml", lang="en")
        c.add_item(nav_css)
        html = f"<h1>Chapter {ch_data['chapter_number']}</h1><h2>{ch_data['title']}</h2>"
        for block in ch_data.get("document_model", {}).get("blocks", []):
            btype = block["type"]
            if btype in ("paragraph", "text"):
                html += f"<p>{block.get('content', '')}</p>"
            elif btype.startswith("heading"):
                lvl = btype[-1]
                html += f"<h{lvl}>{block.get('content', '')}</h{lvl}>"
        c.content = f"<html><body>{html}</body></html>"
        book.add_item(c)
        epub_chapters.append(c)

    c_about = epub.EpubHtml(title="About the Author", file_name="about.xhtml")
    c_about.content = f"<h1>About the Author</h1><p>{meta.get('author_bio', f'{author} is a visionary author.')}</p>"
    book.add_item(c_about)
    epub_chapters.append(c_about)

    book.toc = tuple(epub.Link(c.file_name, c.title, c.title) for c in epub_chapters)
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav"] + epub_chapters

    buffer = io.BytesIO()
    epub.write_epub(buffer, book)
    return buffer.getvalue()


# ── PDF Toolkit (PyMuPDF operations) ─────────────────────────────────────────

def merge_pdfs(pdf_bytes_list: List[bytes]) -> bytes:
    result = fitz.open()
    for pdf_bytes in pdf_bytes_list:
        src = fitz.open(stream=pdf_bytes, filetype="pdf")
        result.insert_pdf(src)
        src.close()
    buf = io.BytesIO()
    result.save(buf)
    result.close()
    return buf.getvalue()


def split_pdf(pdf_bytes: bytes, page_ranges: List[Dict[str, int]]) -> List[bytes]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total = len(doc)
    results = []
    for r in page_ranges:
        new_doc = fitz.open()
        new_doc.insert_pdf(doc, from_page=max(0, r.get("start", 0)), to_page=min(total - 1, r.get("end", total - 1)))
        buf = io.BytesIO()
        new_doc.save(buf)
        new_doc.close()
        results.append(buf.getvalue())
    doc.close()
    return results


def compress_pdf(pdf_bytes: bytes) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    buf = io.BytesIO()
    doc.save(buf, garbage=4, deflate=True, clean=True)
    doc.close()
    return buf.getvalue()


def rotate_pages(pdf_bytes: bytes, rotation: int, page_indices: Optional[List[int]] = None) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for idx in (page_indices if page_indices is not None else range(len(doc))):
        if 0 <= idx < len(doc):
            doc[idx].set_rotation(rotation)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def add_watermark(pdf_bytes: bytes, text: str, opacity: float = 0.3) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    grey = 1.0 - opacity
    for page in doc:
        rect = page.rect
        page.insert_text(
            fitz.Point(rect.width * 0.2, rect.height * 0.6),
            text,
            fontsize=min(rect.width / max(len(text), 1) * 1.5, 60),
            color=(grey, grey, grey),
            rotate=45,
        )
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def protect_pdf(pdf_bytes: bytes, user_password: str, owner_password: Optional[str] = None) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    buf = io.BytesIO()
    doc.save(buf, encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw=owner_password or user_password, user_pw=user_password, permissions=fitz.PDF_PERM_PRINT | fitz.PDF_PERM_COPY)
    doc.close()
    return buf.getvalue()


def extract_images_from_pdf(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    seen: set = set()
    for page_num, page in enumerate(doc):
        for img_index, img in enumerate(page.get_images(full=True)):
            xref = img[0]
            if xref in seen:
                continue
            seen.add(xref)
            try:
                base_img = doc.extract_image(xref)
                images.append({
                    "page": page_num, "index": img_index,
                    "ext": base_img["ext"], "width": base_img["width"], "height": base_img["height"],
                    "data": base64.b64encode(base_img["image"]).decode(),
                })
            except Exception:
                continue
    doc.close()
    return images


def detect_form_fields(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    fields = []
    for page_num, page in enumerate(doc):
        for widget in page.widgets():
            fields.append({
                "name": widget.field_name, "label": widget.field_label or widget.field_name,
                "type": widget.field_type_string, "page": page_num,
                "bbox": list(widget.rect), "value": widget.field_value,
            })
    doc.close()
    return fields


def fill_form_fields(pdf_bytes: bytes, field_values: Dict[str, str]) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        for widget in page.widgets():
            if widget.field_name in field_values:
                widget.field_value = str(field_values[widget.field_name])
                widget.update()
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()
