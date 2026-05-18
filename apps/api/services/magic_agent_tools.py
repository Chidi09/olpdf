"""Tool definitions, inspector tools, and executors for the Magic AI ReAct agent."""

import asyncio
import io
import json
import logging
import re
from typing import Any, Dict, List, Optional

import fitz

from ..config import get_settings
from ..core.storage_client import r2_storage
from ..export_utils import (
    compress_pdf,
    rotate_pages,
    add_watermark,
    protect_pdf,
    extract_images_from_pdf,
    detect_form_fields,
    fill_form_fields,
    apply_true_redaction,
)

logger = logging.getLogger(__name__)


# ── Tool schemas (Gemini function-declaration format) ────────────────────

INSPECTOR_TOOL_DEFINITIONS = [
    {
        "function_declarations": [
            {
                "name": "get_pdf_info",
                "description": "Get document info: page count, dimensions on each page, metadata (title, author, subject), and encryption status.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "peek_pages",
                "description": "Extract plain text from the first N pages so you can inspect document content before deciding which operations to run.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "count": {
                            "type": "INTEGER",
                            "description": "Number of pages to peek from the start. Default 3.",
                        }
                    },
                },
            },
        ]
    }
]

MUTATOR_TOOL_DEFINITIONS = [
    {
        "function_declarations": [
            {
                "name": "extract_pages",
                "description": "Extract specific page ranges into a new PDF.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "page_ranges": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "start": {"type": "INTEGER"},
                                    "end": {"type": "INTEGER"},
                                },
                                "required": ["start", "end"],
                            },
                        }
                    },
                    "required": ["page_ranges"],
                },
            },
            {
                "name": "delete_pages",
                "description": "Delete pages by their zero-based indices.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "page_indices": {
                            "type": "ARRAY",
                            "items": {"type": "INTEGER"},
                        }
                    },
                    "required": ["page_indices"],
                },
            },
            {
                "name": "rotate_pages",
                "description": "Rotate all pages or specific pages by 90, 180, or 270 degrees.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "rotation": {"type": "INTEGER", "enum": [90, 180, 270]},
                        "page_indices": {"type": "ARRAY", "items": {"type": "INTEGER"}},
                    },
                    "required": ["rotation"],
                },
            },
            {
                "name": "compress",
                "description": "Compress PDF to reduce file size (garbage collection, deflate, clean).",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "add_watermark",
                "description": "Add diagonal text watermark across every page.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "text": {"type": "STRING"},
                        "opacity": {
                            "type": "NUMBER",
                            "description": "Opacity from 0.0 (invisible) to 1.0 (solid). Default 0.3.",
                        },
                    },
                    "required": ["text"],
                },
            },
            {
                "name": "protect",
                "description": "Password-protect the PDF with AES-256 encryption.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "user_password": {"type": "STRING"},
                        "owner_password": {"type": "STRING"},
                    },
                    "required": ["user_password"],
                },
            },
            {
                "name": "redact_text",
                "description": "Redact all text matching a regex pattern (permanently removed, not just obscured).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "pattern": {
                            "type": "STRING",
                            "description": "Regular expression pattern to match text for redaction.",
                        }
                    },
                    "required": ["pattern"],
                },
            },
            {
                "name": "grayscale",
                "description": "Convert all colors in the PDF to grayscale / black-and-white.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "remove_metadata",
                "description": "Strip all document metadata (title, author, subject, keywords, etc.).",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "set_metadata",
                "description": "Set document metadata fields.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "title": {"type": "STRING"},
                        "author": {"type": "STRING"},
                        "subject": {"type": "STRING"},
                        "keywords": {"type": "STRING"},
                    },
                },
            },
            {
                "name": "add_page_numbers",
                "description": "Stamp page numbers on every page at a chosen position.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "text": {
                            "type": "STRING",
                            "description": "Template string. Use {n} as the page-number placeholder. Default 'Page {n}'.",
                        },
                        "start_number": {
                            "type": "INTEGER",
                            "description": "Number for the first page. Default 1.",
                        },
                        "position": {
                            "type": "STRING",
                            "enum": ["bottom_center", "bottom_left", "bottom_right", "top_center", "top_left", "top_right"],
                            "description": "Position on the page. Default bottom_center.",
                        },
                    },
                },
            },
            {
                "name": "add_header",
                "description": "Insert repeating header text at the top of every page.",
                "parameters": {"type": "OBJECT", "properties": {"text": {"type": "STRING"}}, "required": ["text"]},
            },
            {
                "name": "add_footer",
                "description": "Insert repeating footer text at the bottom of every page.",
                "parameters": {"type": "OBJECT", "properties": {"text": {"type": "STRING"}}, "required": ["text"]},
            },
            {
                "name": "crop_pages",
                "description": "Apply a crop box to all pages or specific pages.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "x0": {"type": "NUMBER"},
                        "y0": {"type": "NUMBER"},
                        "x1": {"type": "NUMBER"},
                        "y1": {"type": "NUMBER"},
                        "page_indices": {"type": "ARRAY", "items": {"type": "INTEGER"}},
                    },
                    "required": ["x0", "y0", "x1", "y1"],
                },
            },
            {
                "name": "reverse_pages",
                "description": "Reverse the page order of the document.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "remove_annotations",
                "description": "Strip all annotations (comments, highlights, drawings, stamps) from the document.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "flatten_forms",
                "description": "Make all interactive form fields static / non-editable.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "invert_colors",
                "description": "Invert all document colors (useful for dark mode).",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "extract_text",
                "description": "Extract all readable text from the PDF and return it as analysis output.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "extract_images",
                "description": "Extract all embedded images from the PDF and return metadata.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "detect_forms",
                "description": "Identify and list all fillable form fields in the PDF.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "fill_forms",
                "description": "Fill interactive form fields with the provided values.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "payload": {
                            "type": "OBJECT",
                            "description": "Dictionary mapping field names to their values.",
                            "additionalProperties": {"type": "STRING"},
                        }
                    },
                    "required": ["payload"],
                },
            },
            {
                "name": "remove_blank_pages",
                "description": "Automatically detect and remove blank / empty pages.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "reorder_pages",
                "description": "Reorder pages by providing the new zero-based page order.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "new_order": {
                            "type": "ARRAY",
                            "items": {"type": "INTEGER"},
                            "description": "New page order as a list of zero-based page indices.",
                        }
                    },
                    "required": ["new_order"],
                },
            },
            {
                "name": "bates_numbering",
                "description": "Apply Bates stamps (sequential numbering) to every page.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "prefix": {"type": "STRING"},
                        "start_number": {"type": "INTEGER", "description": "Starting number. Default 1."},
                    },
                    "required": ["prefix"],
                },
            },
            {
                "name": "cleanup",
                "description": "Garbage collect unused objects and optimize the PDF structure.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "remove_bookmarks",
                "description": "Delete the document outline / bookmark tree.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "create_bookmarks",
                "description": "Auto-generate a document outline from heading-like text in the document.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "embed_fonts",
                "description": "Force-embed all fonts used in the document into the PDF file.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "extract_tables",
                "description": "Detect tables in the document and extract them as CSV-like structured data.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "extract_links",
                "description": "Extract all hyperlinks, URIs, and cross-document links from the PDF.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "remove_javascript",
                "description": "Strip all JavaScript actions from the PDF document.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "print_to_pdf",
                "description": "Re-save the document natively to strip unusual encodings or corruption.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "measure_dimensions",
                "description": "Report exact page dimensions (in points) for every page.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "split_by_size",
                "description": "Split the document into separate PDF chunks each at most N MB.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "max_mb": {"type": "NUMBER", "description": "Maximum file size per chunk in megabytes. Default 10."}
                    },
                },
            },
            {
                "name": "add_stamp",
                "description": "Overlay a rubber-stamp annotation with custom text onto every page.",
                "parameters": {"type": "OBJECT", "properties": {"text": {"type": "STRING"}}, "required": ["text"]},
            },
            {
                "name": "replace_text",
                "description": "Find and replace text in the document (preserves formatting where possible).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "find_text": {"type": "STRING"},
                        "replace_text": {"type": "STRING"},
                    },
                    "required": ["find_text", "replace_text"],
                },
            },
            {
                "name": "ocr",
                "description": "Run OCR on scanned pages to make text searchable and selectable.",
                "parameters": {"type": "OBJECT", "properties": {}},
            },
            {
                "name": "pdf_to_images",
                "description": "Convert each page of the PDF to a separate PNG or JPEG image.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "format": {"type": "STRING", "enum": ["png", "jpg"], "description": "Image format. Default png."},
                        "dpi": {"type": "INTEGER", "description": "Output resolution in DPI. Default 150."},
                    },
                },
            },
            {
                "name": "remove_passwords",
                "description": "Remove password protection from an encrypted PDF (requires the current password).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {"password": {"type": "STRING"}},
                    "required": ["password"],
                },
            },
        ]
    }
]

ALL_TOOL_DEFINITIONS = INSPECTOR_TOOL_DEFINITIONS + MUTATOR_TOOL_DEFINITIONS


REACT_SYSTEM_PROMPT = """You are a PDF processing agent. Your job is to fulfill the user's PDF manipulation request by reasoning step by step and calling tools.

AVAILABLE TOOLS:
You have inspector tools (get_pdf_info, peek_pages) to examine the document, and mutator tools (extract_pages, compress, add_watermark, etc.) to transform it.

HOW TO OPERATE:
1. First, use get_pdf_info or peek_pages to understand the document structure.
2. Then plan and execute the required operations one at a time.
3. After each tool call you will receive the result. Use this information to decide the next step.
4. When all operations are complete, respond with a summary of what was done.

SELF-CORRECTION:
- If a tool returns an error, try an alternative approach or explain the limitation.
- If you don't have enough information, use the inspector tools to learn more.
- If an operation is truly impossible with the available tools, explain why.

IMPORTANT:
- Call only ONE tool at a time. Wait for the result before making the next call.
- Use zero-based page indices everywhere.
- When you are done processing, respond with a clear summary of all operations performed.
"""


# ── Helpers ──────────────────────────────────────────────────────────────

def download_pdf_bytes(doc_id: str) -> bytes:
    object_name = f"documents/{doc_id}.pdf"
    data = r2_storage.download_bytes(object_name)
    if not data:
        raise ValueError(f"Original PDF not found for document {doc_id}")
    return data


def upload_result_bytes(data: bytes, filename: str) -> str:
    object_name = f"magic/{filename}"
    r2_storage.upload_bytes(data, object_name)
    signed = r2_storage.generate_presigned_url(object_name, expiration=86400)
    return signed or ""


def _parse_page_ranges(page_ranges: list) -> list:
    indices = []
    for r in page_ranges:
        start = r.get("start", 0)
        end = r.get("end", 0)
        for i in range(start, end + 1):
            indices.append(i)
    return indices


def _resolve_position(position: str, page: fitz.Page, text: str, fontsize: float):
    rect = page.rect
    tw = fitz.get_text_length(text, fontsize=fontsize)
    margin = 36
    positions = {
        "top_left": fitz.Point(margin, margin + fontsize),
        "top_right": fitz.Point(rect.width - tw - margin, margin + fontsize),
        "bottom_left": fitz.Point(margin, rect.height - margin),
        "bottom_right": fitz.Point(rect.width - tw - margin, rect.height - margin),
        "top_center": fitz.Point((rect.width - tw) / 2, margin + fontsize),
        "bottom_center": fitz.Point((rect.width - tw) / 2, rect.height - margin),
    }
    return positions.get(position, positions["bottom_center"])


# ── Inspector executors ──────────────────────────────────────────────────

def _exec_get_pdf_info(pdf_bytes: bytes, args: dict) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    info = {
        "page_count": len(doc),
        "metadata": doc.metadata or {},
        "pages": [],
    }
    for i, page in enumerate(doc):
        r = page.rect
        info["pages"].append({
            "index": i,
            "width_points": r.width,
            "height_points": r.height,
        })
    info["is_encrypted"] = doc.is_encrypted
    doc.close()
    return json.dumps(info)


def _exec_peek_pages(pdf_bytes: bytes, args: dict) -> str:
    count = int(args.get("count", 3))
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    texts = []
    for i in range(min(count, len(doc))):
        page_text = doc[i].get_text().strip()
        texts.append({"page": i, "text_preview": page_text[:2000]})
    doc.close()
    return json.dumps({"peeked_pages": texts})


# ── Mutator executors (mirror the originals from magic_orchestrator) ─────

async def _exec_extract_pages(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_indices = _parse_page_ranges(args.get("page_ranges", []))
    new_doc = fitz.open()
    for idx in page_indices:
        if 0 <= idx < len(doc):
            new_doc.insert_pdf(doc, from_page=idx, to_page=idx)
    buf = io.BytesIO()
    new_doc.save(buf)
    doc.close()
    new_doc.close()
    return buf.getvalue()


async def _exec_delete_pages(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    indices = sorted(args.get("page_indices", []), reverse=True)
    for idx in indices:
        if 0 <= idx < len(doc):
            doc.delete_page(idx)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_rotate_pages(pdf_bytes: bytes, args: dict) -> bytes:
    rotation = int(args.get("rotation", 90))
    page_indices = args.get("page_indices")
    return rotate_pages(pdf_bytes, rotation, page_indices)


async def _exec_compress(pdf_bytes: bytes, args: dict) -> bytes:
    return compress_pdf(pdf_bytes)


async def _exec_add_watermark(pdf_bytes: bytes, args: dict) -> bytes:
    text = args.get("text", "")
    opacity = float(args.get("opacity", 0.3))
    return add_watermark(pdf_bytes, text, opacity)


async def _exec_protect(pdf_bytes: bytes, args: dict) -> bytes:
    user_password = args.get("user_password", "")
    owner_password = args.get("owner_password")
    return protect_pdf(pdf_bytes, user_password, owner_password)


async def _exec_redact_text(pdf_bytes: bytes, args: dict) -> bytes:
    pattern = args.get("pattern", "")
    rx = re.compile(pattern, re.IGNORECASE)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        words = page.get_text("words")
        for w in words:
            if rx.search(w[4]):
                rect = fitz.Rect(w[0], w[1], w[2], w[3])
                page.add_redact_annot(rect, fill=(0, 0, 0))
        page.apply_redactions()
    buf = io.BytesIO()
    doc.save(buf, garbage=4, deflate=True)
    doc.close()
    return buf.getvalue()


async def _exec_grayscale(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        page.set_colorspace(fitz.csGRAY)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_remove_metadata(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    doc.set_metadata({})
    doc.del_xml_metadata()
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_set_metadata(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    meta = {}
    for key in ("title", "author", "subject", "keywords"):
        if key in args and args[key]:
            meta[key] = str(args[key])
    if meta:
        doc.set_metadata(meta)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_add_page_numbers(pdf_bytes: bytes, args: dict) -> bytes:
    text_template = args.get("text", "Page {n}")
    start_number = int(args.get("start_number", 1))
    position = args.get("position", "bottom_center")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for i, page in enumerate(doc):
        n = start_number + i
        label = text_template.replace("{n}", str(n))
        fontsize = 10
        pt = _resolve_position(position, page, label, fontsize)
        page.insert_text(pt, label, fontsize=fontsize, color=(0.3, 0.3, 0.3))
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_add_header(pdf_bytes: bytes, args: dict) -> bytes:
    text = args.get("text", "")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        pt = fitz.Point(36, 36)
        page.insert_text(pt, text, fontsize=10, color=(0.3, 0.3, 0.3))
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_add_footer(pdf_bytes: bytes, args: dict) -> bytes:
    text = args.get("text", "")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        fontsize = 10
        rect = page.rect
        tw = fitz.get_text_length(text, fontsize=fontsize)
        pt = fitz.Point((rect.width - tw) / 2, rect.height - 24)
        page.insert_text(pt, text, fontsize=fontsize, color=(0.3, 0.3, 0.3))
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_crop_pages(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    crop = fitz.Rect(
        float(args.get("x0", 0)),
        float(args.get("y0", 0)),
        float(args.get("x1", 612)),
        float(args.get("y1", 792)),
    )
    page_indices = args.get("page_indices")
    for i, page in enumerate(doc):
        if page_indices is None or i in page_indices:
            page.set_cropbox(crop)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_reverse_pages(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total = len(doc)
    if total <= 1:
        doc.close()
        return pdf_bytes
    doc.select(list(range(total - 1, -1, -1)))
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_remove_annotations(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        annots = list(page.annots()) if page.annots() else []
        for a in annots:
            page.delete_annot(a)
    buf = io.BytesIO()
    doc.save(buf, garbage=4, deflate=True)
    doc.close()
    return buf.getvalue()


async def _exec_flatten_forms(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        for widget in page.widgets():
            widget.set_flags(fitz.PDF_WIDGET_FLAG_READ_ONLY)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_invert_colors(pdf_bytes: bytes, args: dict) -> bytes:
    raise ValueError("invert_colors requires external tool (not yet implemented)")


async def _exec_extract_text(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    texts = []
    for i, page in enumerate(doc):
        texts.append({"page": i, "text": page.get_text()})
    doc.close()
    _last_analysis_result = {"tool": "extract_text", "result": texts}
    raise ValueError(f"__analysis__:{json.dumps(_last_analysis_result)}")


async def _exec_extract_images(pdf_bytes: bytes, args: dict) -> bytes:
    images = extract_images_from_pdf(pdf_bytes)
    _last_analysis_result = {"tool": "extract_images", "result": images}
    raise ValueError(f"__analysis__:{json.dumps(_last_analysis_result)}")


async def _exec_detect_forms(pdf_bytes: bytes, args: dict) -> bytes:
    fields = detect_form_fields(pdf_bytes)
    _last_analysis_result = {"tool": "detect_forms", "result": fields}
    raise ValueError(f"__analysis__:{json.dumps(_last_analysis_result)}")


async def _exec_fill_forms(pdf_bytes: bytes, args: dict) -> bytes:
    payload = args.get("payload", {})
    return fill_form_fields(pdf_bytes, payload)


async def _exec_remove_blank_pages(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    to_keep = []
    for i, page in enumerate(doc):
        text = page.get_text().strip()
        images = page.get_images()
        if text or images:
            to_keep.append(i)
    if not to_keep:
        doc.close()
        return pdf_bytes
    doc.select(to_keep)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_reorder_pages(pdf_bytes: bytes, args: dict) -> bytes:
    new_order = args.get("new_order", [])
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    valid = [i for i in new_order if 0 <= i < len(doc)]
    if not valid:
        doc.close()
        return pdf_bytes
    doc.select(valid)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_bates_numbering(pdf_bytes: bytes, args: dict) -> bytes:
    prefix = args.get("prefix", "")
    start_number = int(args.get("start_number", 1))
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for i, page in enumerate(doc):
        n = start_number + i
        label = f"{prefix}{n:06d}"
        pt = fitz.Point(36, page.rect.height - 24)
        page.insert_text(pt, label, fontsize=8, color=(0, 0, 0))
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_cleanup(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    buf = io.BytesIO()
    doc.save(buf, garbage=4, deflate=True, clean=True)
    doc.close()
    return buf.getvalue()


async def _exec_remove_bookmarks(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    doc.set_toc([])
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_create_bookmarks(pdf_bytes: bytes, args: dict) -> bytes:
    raise ValueError("create_bookmarks is not implemented")


async def _exec_embed_fonts(pdf_bytes: bytes, args: dict) -> bytes:
    raise ValueError("embed_fonts is not implemented")


async def _exec_extract_tables(pdf_bytes: bytes, args: dict) -> bytes:
    raise ValueError("extract_tables is not implemented")


async def _exec_extract_links(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    links = []
    for i, page in enumerate(doc):
        for link in page.get_links():
            links.append({"page": i, **link})
    doc.close()
    _last_analysis_result = {"tool": "extract_links", "result": links}
    raise ValueError(f"__analysis__:{json.dumps(_last_analysis_result)}")


async def _exec_remove_javascript(pdf_bytes: bytes, args: dict) -> bytes:
    raise ValueError("remove_javascript is not implemented")


async def _exec_print_to_pdf(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    buf = io.BytesIO()
    doc.save(buf, garbage=4, deflate=True)
    doc.close()
    return buf.getvalue()


async def _exec_measure_dimensions(pdf_bytes: bytes, args: dict) -> bytes:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    dims = []
    for i, page in enumerate(doc):
        r = page.rect
        dims.append({"page": i, "width": r.width, "height": r.height})
    doc.close()
    _last_analysis_result = {"tool": "measure_dimensions", "result": dims}
    raise ValueError(f"__analysis__:{json.dumps(_last_analysis_result)}")


async def _exec_split_by_size(pdf_bytes: bytes, args: dict) -> bytes:
    max_mb = float(args.get("max_mb", 10))
    max_bytes = int(max_mb * 1024 * 1024)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total = len(doc)
    if total == 0:
        doc.close()
        return pdf_bytes
    chunks = []
    current = fitz.open()
    for i in range(total):
        current.insert_pdf(doc, from_page=i, to_page=i)
        buf = io.BytesIO()
        current.save(buf)
        size = buf.tell()
        if size >= max_bytes or i == total - 1:
            chunks.append(buf.getvalue())
            current.close()
            current = fitz.open()
    doc.close()
    current.close()
    if len(chunks) <= 1:
        return chunks[0] if chunks else pdf_bytes
    merged = fitz.open()
    for chunk in chunks:
        src = fitz.open(stream=chunk, filetype="pdf")
        merged.insert_pdf(src)
        src.close()
    buf = io.BytesIO()
    merged.save(buf)
    merged.close()
    return buf.getvalue()


async def _exec_add_stamp(pdf_bytes: bytes, args: dict) -> bytes:
    text = args.get("text", "")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        rect = page.rect
        stamp_rect = fitz.Rect(
            rect.width * 0.6, rect.height * 0.1,
            rect.width * 0.95, rect.height * 0.2,
        )
        page.add_stamp_annot(stamp_rect, stamp=0)
        page.insert_text(
            fitz.Point(stamp_rect.x0 + 4, stamp_rect.y0 + 12),
            text, fontsize=8, color=(0.6, 0, 0),
        )
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


async def _exec_replace_text(pdf_bytes: bytes, args: dict) -> bytes:
    raise ValueError("replace_text is not implemented")


async def _exec_ocr(pdf_bytes: bytes, args: dict) -> bytes:
    raise ValueError("ocr is not implemented")


async def _exec_pdf_to_images(pdf_bytes: bytes, args: dict) -> bytes:
    fmt = args.get("format", "png")
    dpi = int(args.get("dpi", 150))
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    import base64
    images = []
    for i, page in enumerate(doc):
        zoom = dpi / 72
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes(fmt)
        images.append({
            "page": i,
            "format": fmt,
            "dpi": dpi,
            "width": pix.width,
            "height": pix.height,
            "data_b64": base64.b64encode(img_bytes).decode(),
        })
    doc.close()
    _last_analysis_result = {"tool": "pdf_to_images", "result": images}
    raise ValueError(f"__analysis__:{json.dumps(_last_analysis_result)}")


async def _exec_remove_passwords(pdf_bytes: bytes, args: dict) -> bytes:
    password = args.get("password", "")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf", password=password)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


# ── Executor registry ────────────────────────────────────────────────────

_INSPECTOR_EXECUTORS = {
    "get_pdf_info": _exec_get_pdf_info,
    "peek_pages": _exec_peek_pages,
}

_MUTATOR_EXECUTORS: Dict[str, Any] = {}
_mutator_names = [
    "extract_pages", "delete_pages", "rotate_pages", "compress",
    "add_watermark", "protect", "redact_text", "grayscale",
    "remove_metadata", "set_metadata", "add_page_numbers",
    "add_header", "add_footer", "crop_pages", "reverse_pages",
    "remove_annotations", "flatten_forms", "invert_colors",
    "extract_text", "extract_images", "detect_forms",
    "fill_forms", "remove_blank_pages", "reorder_pages",
    "bates_numbering", "cleanup", "remove_bookmarks", "create_bookmarks",
    "embed_fonts", "extract_tables", "extract_links", "remove_javascript",
    "print_to_pdf", "measure_dimensions", "split_by_size", "add_stamp",
    "replace_text", "ocr", "pdf_to_images", "remove_passwords",
]

for _name in _mutator_names:
    func_name = f"_exec_{_name}"
    if func_name in locals():
        _MUTATOR_EXECUTORS[_name] = locals()[func_name]

ALL_EXECUTORS = {**_INSPECTOR_EXECUTORS, **_MUTATOR_EXECUTORS}


def is_inspector_tool(name: str) -> bool:
    return name in _INSPECTOR_EXECUTORS


def is_mutator_tool(name: str) -> bool:
    return name in _MUTATOR_EXECUTORS
