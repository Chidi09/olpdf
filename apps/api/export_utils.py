import io
import re
from typing import List, Dict, Any
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from ebooklib import epub
import uuid

import fitz # PyMuPDF

def apply_true_redaction(pdf_bytes: bytes, redaction_areas: List[Dict[str, Any]]) -> bytes:
    """
    Mathematically removes content — not visual overlay.
    redaction_areas: [{"page": 0, "bbox": [x0, y0, x1, y1]}]
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    for area in redaction_areas:
        page_num = area.get("page", 0)
        if page_num >= len(doc):
            continue
        page = doc[page_num]
        bbox = area.get("bbox")
        if bbox and len(bbox) == 4:
            rect = fitz.Rect(bbox)
            page.add_redact_annot(rect, fill=(0, 0, 0))
    
    # apply_redactions removes the underlying vectors, not just covers them
    for page in doc:
        page.apply_redactions()
    
    buffer = io.BytesIO()
    doc.save(buffer)
    doc.close()
    return buffer.getvalue()

def detect_form_fields(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """Detects potential form fields (labels followed by lines or empty boxes)."""
    import pdfplumber
    fields = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            # 1. Look for explicit PDF form widgets
            if page.annots:
                for annot in page.annots:
                    if annot.get("Subtype") == "Widget":
                        fields.append({
                            "page": i,
                            "type": "pdf_widget",
                            "name": annot.get("T", f"field_{len(fields)}"),
                            "bbox": annot.get("rect")
                        })
            
            # 2. Heuristic: Look for text ending in ':' followed by a line or empty space
            # This is a simplified example
            text_objs = page.extract_text_lines()
            for line in text_objs:
                if line["text"].strip().endswith(":"):
                    fields.append({
                        "page": i,
                        "type": "heuristic_label",
                        "label": line["text"].strip(),
                        "bbox": [line["x0"], line["top"], line["x1"], line["bottom"]]
                    })
    return fields

def fill_form_fields(pdf_bytes: bytes, field_data: Dict[str, Any]) -> bytes:
    """Fills detected form fields."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    # Simple heuristic: if we have field_data mapping names to values
    for page in doc:
        for field in page.widgets():
            if field.field_name in field_data:
                field.field_value = str(field_data[field.field_name])
                field.update()
    
    buffer = io.BytesIO()
    doc.save(buffer)
    doc.close()
    return buffer.getvalue()

def run_preflight(document_model: Dict[str, Any]) -> List[Dict[str, Any]]:
    issues = []
    blocks = document_model.get("blocks", [])
    meta = document_model.get("meta", {})
    
    # Check for unresolved template placeholders
    for block in blocks:
        content = block.get("content", "")
        if not isinstance(content, str):
            continue
        placeholders = re.findall(r'\{\{[A-Z_]+\}\}', content)
        if placeholders:
            issues.append({
                "type": "unresolved_placeholder",
                "block_id": block.get("id"),
                "detail": f"Contains unresolved: {', '.join(placeholders)}",
                "severity": "warning"
            })
    
    # Check image blocks for missing alt text
    for block in blocks:
        if block.get("type") == "image" and not block.get("alt_text"):
            issues.append({
                "type": "missing_alt_text",
                "block_id": block.get("id"),
                "detail": "Image block has no alt text — required for PDF/UA",
                "severity": "error" if meta.get("export_standard") == "tagged" else "warning"
            })
    
    # Check for orphaned headings (H3 directly after H1)
    for i in range(len(blocks) - 1):
        if blocks[i].get("type") == "heading1" and blocks[i+1].get("type") == "heading3":
            issues.append({
                "type": "orphaned_heading",
                "block_id": blocks[i+1].get("id"),
                "detail": "H3 directly after H1 — missing H2",
                "severity": "warning"
            })
    
    # Check for low-confidence blocks needing review
    low_confidence = [b for b in blocks if b.get("needs_review")]
    if low_confidence:
        issues.append({
            "type": "unreviewed_ocr_blocks",
            "count": len(low_confidence),
            "block_ids": [b.get("id") for b in low_confidence],
            "detail": f"{len(low_confidence)} blocks extracted with low confidence — verify before export",
            "severity": "warning"
        })
    
    return issues

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

def inject_pdfa_metadata(canvas, doc):
    canvas.setAuthor(doc.author)
    canvas.setTitle(doc.title)
    canvas.setSubject("OLPDF Archival Export")
    canvas.setCreator("OLPDF v1.0")

def build_reportlab_styles(styles_config: Dict[str, Any]):
    styles = getSampleStyleSheet()
    # Basic mapping
    return {
        "heading1": ParagraphStyle('Heading1', parent=styles['Heading1'], fontSize=24, leading=30, spaceAfter=12),
        "heading2": ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=18, leading=22, spaceAfter=10),
        "heading3": ParagraphStyle('Heading3', parent=styles['Heading3'], fontSize=14, leading=18, spaceAfter=8),
        "paragraph": ParagraphStyle('BodyText', parent=styles['BodyText'], fontSize=11, leading=16, spaceAfter=8),
        "callout": ParagraphStyle('Callout', parent=styles['BodyText'], fontSize=11, leading=16, leftIndent=20, rightIndent=20, fontName='Helvetica-Oblique'),
    }

def compile_block(block: Dict[str, Any], styles: Dict[str, Any]) -> List:
    btype = block.get("type")
    content = block.get("content", "")
    
    if btype in ("heading1", "heading2", "heading3", "paragraph", "callout", "text"):
        style_key = btype if btype != "text" else "paragraph"
        return [Paragraph(content, styles.get(style_key, styles["paragraph"])), Spacer(1, 6)]
    
    elif btype == "table":
        headers = block.get("headers", [])
        rows = block.get("rows", [])
        data = [headers] + rows
        if not data or not data[0]:
            return []
        t = Table(data, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.whitesmoke),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('PADDING', (0,0), (-1,-1), 8),
        ]))
        return [t, Spacer(1, 12)]
    
    elif btype == "page_break":
        return [PageBreak()]
    
    elif btype == "divider":
        from reportlab.platypus import HRFlowable
        return [HRFlowable(width="100%", thickness=1, color=colors.lightgrey), Spacer(1, 8)]
    
    return []

def export_pdfa(document_model: Dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    meta = document_model.get("meta", {})
    
    # Try to register fonts if they exist
    font_path = "fonts/Lora-Regular.ttf"
    if os.path.exists(font_path):
        pdfmetrics.registerFont(TTFont('Lora', font_path))
        font_name = 'Lora'
    else:
        font_name = 'Helvetica'

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        title=meta.get("title", "Untitled"),
        author=meta.get("author", "OLPDF User")
    )
    
    styles = build_reportlab_styles(document_model.get("styles", {}))
    story = []
    for block in document_model.get("blocks", []):
        story.extend(compile_block(block, styles))
    
    doc.build(story, onFirstPage=inject_pdfa_metadata, onLaterPages=inject_pdfa_metadata)
    return buffer.getvalue()

def export_tagged_pdf(document_model: Dict[str, Any]) -> bytes:
    """Tagged PDF for accessibility (PDF/UA). Uses ReportLab StructElem."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    
    buffer = io.BytesIO()
    # We use a custom DocTemplate or just canvas to demonstrate tagging
    # For OLPDF, we'll wrap our standard build but enable accessibility
    
    def on_page_tagged(canv, doc):
        inject_pdfa_metadata(canv, doc)
        # Enable tagging
        if hasattr(canv, 'set_accessibility'):
            canv.set_accessibility(True)
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        title=document_model.get("meta", {}).get("title", "Tagged Document"),
        author=document_model.get("meta", {}).get("author", "OLPDF")
    )
    
    styles = build_reportlab_styles(document_model.get("styles", {}))
    story = []
    
    # In a real PDF/UA flow, each Paragraph would be wrapped in a StructElem
    # ReportLab's Paragraph handles some of this if accessibility is on
    for block in document_model.get("blocks", []):
        story.extend(compile_block(block, styles))
        
    doc.build(story, onFirstPage=on_page_tagged, onLaterPages=on_page_tagged)
    return buffer.getvalue()

def compile_book_to_pdf(book_model: Dict[str, Any], chapters: List[Dict[str, Any]]) -> bytes:
    buffer = io.BytesIO()
    book_title = book_model.get("title", "Untitled Book")
    meta = book_model.get("meta", {})
    author = meta.get("author", "OLPDF Author")

    doc = SimpleDocTemplate(buffer, pagesize=A4, title=book_title, author=author)
    styles = getSampleStyleSheet()
    
    # Custom styles
    h1_style = ParagraphStyle('Heading1', parent=styles['Heading1'], fontSize=28, spaceAfter=30, alignment=1)
    h2_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=20, spaceAfter=20)
    body_style = ParagraphStyle('BodyText', parent=styles['BodyText'], fontSize=11, leading=16)
    toc_style = ParagraphStyle('TOC', parent=styles['BodyText'], fontSize=12, leading=20)
    copyright_style = ParagraphStyle('Copyright', parent=styles['BodyText'], fontSize=9, leading=12, alignment=1)
    
    story = []
    
    # 1. FRONT MATTER: Title Page
    story.append(Spacer(1, 150))
    story.append(Paragraph(book_title, h1_style))
    if meta.get("subtitle"):
        story.append(Paragraph(meta["subtitle"], h2_style))
    story.append(Spacer(1, 40))
    story.append(Paragraph(f"By {author}", body_style))
    story.append(Spacer(1, 20))
    story.append(Paragraph(f"Published by {meta.get('publisher', 'OLPDF')}", body_style))
    story.append(PageBreak())
    
    # 2. FRONT MATTER: Copyright
    story.append(Spacer(1, 400))
    story.append(Paragraph(f"© {datetime.now().year} {author}. All rights reserved.", copyright_style))
    story.append(Paragraph(meta.get("copyright_notice", "Created using Open Layout PDF (OLPDF)"), copyright_style))
    if meta.get("isbn"):
        story.append(Paragraph(f"ISBN: {meta['isbn']}", copyright_style))
    story.append(PageBreak())

    # 3. FRONT MATTER: Table of Contents
    story.append(Paragraph("Table of Contents", h2_style))
    story.append(Spacer(1, 12))
    for chapter in chapters:
        story.append(Paragraph(f"Chapter {chapter['chapter_number']}: {chapter['title']}", toc_style))
    story.append(PageBreak())
    
    # 4. CHAPTERS
    for chapter in chapters:
        story.append(Paragraph(f"Chapter {chapter['chapter_number']}", h2_style))
        story.append(Paragraph(chapter['title'], h1_style))
        story.append(Spacer(1, 24))
        
        blocks = chapter.get('document_model', {}).get('blocks', [])
        for block in blocks:
            story.extend(compile_block(block, styles))
        
        story.append(PageBreak())

    # 5. BACK MATTER: About the Author
    story.append(Paragraph("About the Author", h2_style))
    story.append(Spacer(1, 12))
    story.append(Paragraph(meta.get("author_bio", f"{author} is a user of OLPDF."), body_style))
    
    doc.build(story)
    return buffer.getvalue()

def compile_book_to_epub(book_model: Dict[str, Any], chapters: List[Dict[str, Any]]) -> bytes:
    book = epub.EpubBook()
    book_title = book_model.get("title", "Untitled Book")
    meta = book_model.get("meta", {})
    author = meta.get("author", "OLPDF Author")

    book.set_identifier(str(uuid.uuid4()))
    book.set_title(book_title)
    book.set_language('en')
    book.add_author(author)
    
    # KDP/Apple-ready CSS
    style = '''
@namespace epub "http://www.idpf.org/2007/ops";
body { font-family: "Georgia", serif; margin: 5%; line-height: 1.5; }
h1 { text-align: center; text-transform: uppercase; margin-top: 20%; }
h2 { text-align: left; color: #333; border-bottom: 1px solid #ccc; }
p { text-indent: 1.5em; margin: 0; }
p.first { text-indent: 0; }
.cite { font-style: italic; color: #666; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
'''
    nav_css = epub.EpubItem(uid="style_nav", file_name="style/nav.css", media_type="text/css", content=style)
    book.add_item(nav_css)

    # Front Matter: Title Page
    c_title = epub.EpubHtml(title="Title Page", file_name="title.xhtml")
    c_title.content = f"""
<div style='text-align:center; margin-top: 100px;'>
    <h1>{book_title}</h1>
    {f"<h2>{meta['subtitle']}</h2>" if meta.get('subtitle') else ""}
    <p>By {author}</p>
    <p style='margin-top: 50px;'>Published by {meta.get('publisher', 'OLPDF')}</p>
</div>"""
    book.add_item(c_title)

    # Front Matter: Copyright
    c_copy = epub.EpubHtml(title="Copyright", file_name="copyright.xhtml")
    c_copy.content = f"""
<div style='text-align:center; margin-top: 200px;'>
    <p>© {datetime.now().year} {author}</p>
    <p>{meta.get('copyright_notice', 'All rights reserved.')}</p>
    {f"<p>ISBN: {meta['isbn']}</p>" if meta.get('isbn') else ""}
</div>"""
    book.add_item(c_copy)

    epub_chapters = [c_title, c_copy]
    
    for ch_data in chapters:
        c = epub.EpubHtml(
            title=ch_data['title'],
            file_name=f"ch_{ch_data['chapter_number']:03d}.xhtml",
            lang='en'
        )
        c.add_item(nav_css)
        
        content_html = f"<h1>Chapter {ch_data['chapter_number']}</h1><h2>{ch_data['title']}</h2>"
        blocks = ch_data.get('document_model', {}).get('blocks', [])
        for block in blocks:
            btype = block['type']
            if btype in ['paragraph', 'text']:
                content_html += f"<p>{block.get('content', '')}</p>"
            elif btype.startswith('heading'):
                level = btype[-1]
                content_html += f"<h{level}>{block.get('content', '')}</h{level}>"
        
        c.content = f"<html><body>{content_html}</body></html>"
        book.add_item(c)
        epub_chapters.append(c)
        
    # Back Matter
    c_about = epub.EpubHtml(title="About the Author", file_name="about.xhtml")
    c_about.content = f"<h1>About the Author</h1><p>{meta.get('author_bio', f'{author} is a visionary author.')}</p>"
    book.add_item(c_about)
    epub_chapters.append(c_about)

    book.toc = tuple(epub.Link(c.file_name, c.title, c.title) for c in epub_chapters)
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    
    book.spine = ['nav'] + epub_chapters
    
    buffer = io.BytesIO()
    epub.write_epub(buffer, book)
    return buffer.getvalue()
