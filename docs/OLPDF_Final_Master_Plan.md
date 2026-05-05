# OLPDF — Open Layout PDF
## Final Master Plan · Architecture + UI/UX Design System
**Structure First. Deterministic Layout Engine. Targeted AI.**

> This document consolidates the v1 platform plan, v2 architectural enhancements, the OLPDF investor brief, and the AI agent execution spec into a single authoritative build reference. It is the only document that matters.

---

## Part I — Product Identity

### Name & Brand

| | |
|---|---|
| **Product Name** | OLPDF |
| **Expanded Meaning** | Open Layout PDF |
| **Primary Tagline** | *Understand the layout. Edit the document.* |
| **Category** | Structure-first AI document studio |
| **Positioning** | OLPDF is not a PDF editor. It is a document operating system — one that understands layout, rebuilds documents intelligently, collaborates in real time, uses AI only where it adds value, and produces professional-grade outputs. |

### Core Philosophy

Six non-negotiable principles govern every engineering and design decision:

| Principle | Meaning |
|---|---|
| **Structure First** | Deterministic layout and content extraction always runs before AI is invoked |
| **AI Only Where Needed** | AI handles rewrite, summarise, fill, suggest, continue, and repair — nothing else |
| **Vision as Routing** | A Vision Router decides which pages need OCR, table extraction, preservation, or AI repair — never blinded blanket processing |
| **Async by Default** | Large imports, OCR, exports, and RAG indexing run in background jobs — no timeouts, no spinners on empty UI |
| **Professional Output** | PDF, PDF/A-1b, Tagged PDF/UA, and EPUB3 are all first-class exports |
| **Collaborative by Design** | Real-time multiplayer and offline resilience are core architecture, not features added later |

---

## Part II — System Architecture

### 2.1 Monorepo Structure (Turborepo)

```
olpdf-monorepo/
├── apps/
│   ├── web/                    # Next.js 14 App Router (Frontend)
│   ├── api/                    # FastAPI (Main backend — Vercel Python runtime)
│   └── worker/                 # Modal GPU Worker (Surya OCR, OpenCV, PaddleOCR)
├── packages/
│   ├── document-model/         # Shared Zod (TS) + Pydantic (Python) schemas
│   ├── ui/                     # Shared React component library (Liquid Glass aesthetic)
│   └── config/                 # ESLint, Prettier, Tailwind, TypeScript base configs
└── docker-compose.yml          # Local dev: Supabase, Redis, QStash emulator
```

**Why Turborepo:** The `document-model` package is the contract between frontend and backend. Both `apps/web` (TypeScript Zod schemas) and `apps/api` (Python Pydantic models) import from it. If a block type changes, both sides update at the same time and compilation fails if they drift.

### 2.2 Full System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND — Next.js 14 App Router                  │
│                                                                       │
│  ┌───────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Document      │ │  Book Maker  │ │Templates │ │ PDF Toolkit  │  │
│  │ Studio        │ │  Workspace   │ │ Library  │ │ (ops center) │  │
│  └───────────────┘ └──────────────┘ └──────────┘ └──────────────┘  │
│                                                                       │
│  TipTap Editor ──── Yjs CRDT ──── y-supabase ──── Supabase Realtime │
│  React Query (server state/cache)  Zustand (UI state)               │
│  IndexedDB (offline persistence)                                       │
│                                                                       │
│  Next.js Edge Middleware → Upstash Redis (rate limiting, auth guard) │
│  Next.js BFF Route Handlers (/app/api/*) for frontend-safe orchestration │
└──────────────────────────────────────────────────────────────────────┘
          │ REST                                  │ Realtime / WebSocket
          ▼                                       ▼
┌─────────────────────┐              ┌────────────────────────────────┐
│   FastAPI Backend   │              │         Supabase               │
│  (Vercel Python)    │              │                                │
│                     │              │  profiles                      │
│  Sync routes:       │              │  documents      (JSONB model)  │
│  /api/documents     │              │  books                         │
│  /api/books         │              │  book_chapters                 │
│  /api/templates     │              │  templates                     │
│  /api/ai/*          │              │  ai_edit_logs   (audit)        │
│                     │              │  chapter_embeddings (pgvector) │
│  Async start routes:│              │  assets         (registry)     │
│  /api/pdf/import-   │──────────┐   │  page_metadata  (per-page)    │
│  start              │          │   │                                │
│  /api/pdf/ocr-start │          │   │  Storage:                      │
│  /api/ai/embed-     │          │   │  user-uploads/  (10MB cap)    │
│  start              │          │   │  exports/       (24hr TTL)    │
│                     │          │   │  covers/                      │
│  PDF Engine:        │          │   │  assets/                      │
│  pdfplumber         │          │   │  fonts/         (PDF/A embed) │
│  reportlab (PDF/A)  │          │   └────────────────────────────────┘
│  EbookLib (EPUB3)   │          │
│  pypdf              │          │   ┌────────────────────────────────┐
│  PyMuPDF (redact)   │          │   │         Upstash                │
└─────────────────────┘          └──▶│  QStash — async job queue      │
                                     │  Redis  — rate limiting        │
                                     └────────────────────────────────┘
                                               │ Triggers
                                               ▼
                                     ┌────────────────────────────────┐
                                     │    Modal GPU Worker (Python)   │
                                     │                                │
                                     │  surya-ocr (layout-aware OCR) │
                                     │  PaddleOCR (table detection)  │
                                     │  OpenCV (color, bounding box) │
                                     │                                │
                                     │  Returns: Document Model JSON  │
                                     │  Updates: Supabase via REST    │
                                     └────────────────────────────────┘
                                               │
                                               ▼
                                     ┌────────────────────────────────┐
                                     │         Gemini API             │
                                     │  gemini-1.5-flash (tools)     │
                                     │  text-embedding-004 (RAG)     │
                                     └────────────────────────────────┘
```

---

## Part III — Core Data Models

### 3.1 Complete Database Schema

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Profiles (extends Supabase Auth)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    plan TEXT DEFAULT 'free',          -- 'free' | 'pro' | 'team'
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_model JSONB NOT NULL DEFAULT '{"blocks":[],"styles":{},"meta":{}}'::jsonb,
    type TEXT DEFAULT 'document',       -- 'document' | 'book_chapter'
    status TEXT DEFAULT 'ready',        -- 'processing' | 'ready' | 'failed'
    import_progress INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Books
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    front_matter JSONB DEFAULT '["title_page","copyright","toc"]'::jsonb,
    back_matter JSONB DEFAULT '["about_author"]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book Chapters
CREATE TABLE book_chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id),
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'draft',        -- 'draft' | 'review' | 'final'
    word_count INTEGER DEFAULT 0,
    sort_order INTEGER NOT NULL,
    embedding_indexed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES profiles(id),
    title TEXT NOT NULL,
    category TEXT NOT NULL,             -- 'business' | 'academic' | 'legal' | 'book' | 'personal'
    document_model JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    uses_count INTEGER DEFAULT 0,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Edit Audit Log
CREATE TABLE ai_edit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    instruction TEXT NOT NULL,
    tool_calls JSONB,                   -- Exact Gemini function calls made
    diff_snapshot JSONB,                -- Before/after block states
    status TEXT DEFAULT 'pending_review', -- 'pending_review' | 'accepted' | 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page-level metadata (per imported page)
CREATE TABLE page_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    page_type TEXT,                     -- 'text' | 'scanned' | 'table_heavy' | 'image_heavy' | 'form' | 'cover' | 'blank' | 'signature'
    extraction_strategy TEXT,           -- 'native' | 'ocr' | 'vision' | 'preserved'
    text_layer_ratio FLOAT,             -- 0.0 - 1.0
    table_likelihood FLOAT,
    image_ratio FLOAT,
    confidence_score FLOAT,
    needs_review BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset Registry (reusable document assets)
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    asset_type TEXT,                    -- 'image' | 'logo' | 'color' | 'font' | 'header' | 'footer'
    storage_url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RAG Embeddings (pgvector)
CREATE TABLE chapter_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES book_chapters(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768)               -- Gemini text-embedding-004 dimensions
);
CREATE INDEX ON chapter_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own documents" ON documents FOR ALL USING (auth.uid() = user_id);
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own books" ON books FOR ALL USING (auth.uid() = user_id);
ALTER TABLE book_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own chapters via books" ON book_chapters FOR ALL
  USING (EXISTS (SELECT 1 FROM books WHERE books.id = book_chapters.book_id AND books.user_id = auth.uid()));
```

### 3.2 Universal Document Model (JSON)

The single source of truth. Both the Yjs CRDT editor and the ReportLab PDF compiler consume this exact schema.

```json
{
  "id": "doc_uuid",
  "meta": {
    "title": "Document Title",
    "author": "Divine Adoyi",
    "page_size": "A4",
    "margins": { "top": 72, "bottom": 72, "left": 72, "right": 72 },
    "export_standard": "pdf_a",
    "layout_mode": "editable"
  },
  "styles": {
    "font_family": "Lora",
    "heading1": { "size": 24, "bold": true, "color": "#111111" },
    "heading2": { "size": 18, "bold": true, "color": "#333333" },
    "body": { "size": 11, "line_height": 1.6, "color": "#2d2d2d" }
  },
  "blocks": [
    {
      "id": "blk_uuid_1",
      "type": "heading1",
      "content": "Executive Summary",
      "confidence_score": 0.98,
      "needs_review": false,
      "bounding_box": [100, 200, 500, 250],
      "style_overrides": {}
    },
    {
      "id": "blk_uuid_2",
      "type": "table",
      "headers": ["Region", "Q2", "Q3", "Growth"],
      "rows": [["UK", "£120k", "£145k", "+20%"]],
      "confidence_score": 0.75,
      "needs_review": true
    }
  ]
}
```

**`confidence_score`** — populated by the Vision Router for imported content. Blocks below 0.80 are flagged `needs_review: true` and highlighted in the editor with a review indicator. This is how the editor guides users to validate machine-extracted content without overwhelming them.

**`layout_mode`** — `"editable"` for standard block editing (reports, books, proposals). `"fidelity"` for visually complex pages (flyers, certificates, invoices) where the layout must be preserved exactly and block editing would break it.

---

## Part IV — The Vision Router

This is the strongest technical differentiator. Most PDF tools treat every page identically. OLPDF classifies each page first and routes to the cheapest reliable extraction strategy.

### 4.1 Page Classification Table

| Page Type | Detection Signal | Strategy |
|---|---|---|
| Native text page | >80% text layer coverage | Direct pdfplumber extraction |
| Scanned page | <20% text layer, high image ratio | Surya OCR + layout reconstruction |
| Table-heavy page | Grid patterns detected, >2 tables | PaddleOCR table extractor first |
| Image-heavy page | >60% image pixels | OpenCV region extraction + captions |
| Form page | Field annotations detected | Field detection + structure preserve |
| Cover page | Single page, large image, no text | Preserve as visual asset |
| Blank page | No text, no significant images | Skip entirely |
| Signature page | Signature field annotations | Preserve visually, do not edit |

### 4.2 Vision Router FastAPI Implementation

```python
import pdfplumber
from io import BytesIO

def classify_page(page) -> dict:
    """Classify a single pdfplumber page and return routing metadata."""
    words = page.extract_words()
    images = page.images
    
    text_coverage = len(words) / max(page.width * page.height / 100, 1)
    image_area = sum(img["width"] * img["height"] for img in images)
    image_ratio = image_area / (page.width * page.height)
    tables = page.find_tables()
    
    # Routing decision
    if text_coverage > 0.8:
        strategy = "native"
        page_type = "text"
    elif text_coverage < 0.2 and image_ratio > 0.5:
        strategy = "ocr"
        page_type = "scanned"
    elif len(tables) >= 2:
        strategy = "table_extraction"
        page_type = "table_heavy"
    elif image_ratio > 0.6:
        strategy = "vision_preserve"
        page_type = "image_heavy"
    else:
        strategy = "native"
        page_type = "text"
    
    return {
        "page_type": page_type,
        "extraction_strategy": strategy,
        "text_layer_ratio": min(text_coverage, 1.0),
        "image_ratio": image_ratio,
        "table_likelihood": min(len(tables) / 5, 1.0),
        "confidence_score": 0.95 if strategy == "native" else 0.70
    }

async def route_pdf_import(pdf_bytes: BytesIO, document_id: str):
    """Vision Router — classify all pages and route to appropriate workers."""
    with pdfplumber.open(pdf_bytes) as pdf:
        pages_needing_ocr = []
        native_pages = []
        
        for idx, page in enumerate(pdf.pages):
            classification = classify_page(page)
            
            # Save page metadata
            supabase.table("page_metadata").insert({
                "document_id": document_id,
                "page_number": idx + 1,
                **classification
            }).execute()
            
            if classification["extraction_strategy"] == "native":
                native_pages.append((idx, page))
            else:
                pages_needing_ocr.append(idx)
        
        # Process native pages immediately
        blocks = []
        for idx, page in native_pages:
            blocks.extend(extract_native_page(page, idx))
        
        # Dispatch OCR pages to Modal GPU worker via QStash
        if pages_needing_ocr:
            qstash.publish_json(
                url=f"{WORKER_URL}/worker/ocr-pages",
                body={
                    "document_id": document_id,
                    "page_indices": pages_needing_ocr,
                    "file_path": f"user-uploads/{document_id}.pdf"
                }
            )
        
        # Save native blocks immediately
        if blocks:
            supabase.table("documents").update({
                "document_model": {"blocks": blocks},
                "status": "partial" if pages_needing_ocr else "ready"
            }).eq("id", document_id).execute()
```

### 4.3 Modal GPU Worker (OCR)

```python
# apps/worker/modal_worker.py
import modal
from surya.ocr import run_ocr
from surya.model.detection.segformer import load_model as load_det_model
from surya.model.recognition.model import load_model as load_rec_model
import cv2
import numpy as np
import httpx
import json

app = modal.App("olpdf-ocr-worker")

# Mount GPU with all models pre-loaded for cold start speed
@app.function(
    gpu="T4",
    image=modal.Image.debian_slim().pip_install(
        "surya-ocr", "paddlepaddle", "paddleocr", "opencv-python-headless", "httpx"
    ),
    timeout=300
)
def process_ocr_pages(document_id: str, page_images: list[bytes], page_indices: list[int]) -> dict:
    """GPU worker: OCR + layout reconstruction for scanned pages."""
    
    det_model, det_processor = load_det_model(), None
    rec_model, rec_processor = load_rec_model(), None
    
    all_blocks = []
    
    for i, (img_bytes, page_idx) in enumerate(zip(page_images, page_indices)):
        # Load image
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Surya OCR — layout-aware, returns bounding boxes + text
        from PIL import Image as PILImage
        pil_img = PILImage.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        ocr_result = run_ocr([pil_img], [["en"]], det_model, det_processor, rec_model, rec_processor)
        
        # OpenCV: extract dominant colors for style inference
        resized = cv2.resize(img, (50, 50))
        pixels = resized.reshape(-1, 3).astype(float)
        dominant_color = pixels.mean(axis=0)
        
        # Build blocks from OCR results with bounding boxes
        for line in ocr_result[0].text_lines:
            confidence = line.confidence
            all_blocks.append({
                "id": f"blk_ocr_{page_idx}_{len(all_blocks)}",
                "type": infer_block_type(line),
                "content": line.text,
                "bounding_box": [
                    line.bbox[0], line.bbox[1], line.bbox[2], line.bbox[3]
                ],
                "confidence_score": confidence,
                "needs_review": confidence < 0.80
            })
        
        # Update progress in Supabase via REST
        progress = int(((i + 1) / len(page_images)) * 100)
        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/documents?id=eq.{document_id}",
            headers={"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"},
            json={"import_progress": progress}
        )
    
    return {"blocks": all_blocks, "document_id": document_id}


def infer_block_type(line) -> str:
    """Infer block type from OCR line properties (font size, position, length)."""
    text = line.text.strip()
    height = line.bbox[3] - line.bbox[1]
    
    if height > 30 and len(text) < 80:
        return "heading1"
    elif height > 20 and len(text) < 120:
        return "heading2"
    else:
        return "paragraph"
```

---

## Part V — Backend Routes

### 5.0 BFF Layer (Next.js Route Handlers)

The web app uses a BFF (Backend for Frontend) layer in `apps/web/app/api/*`.
The BFF handles cookie/session context, request shaping, and cache-friendly response contracts for React Query.
The BFF calls FastAPI routes for domain execution; it does not duplicate business logic.

```
GET    /app/api/bff/documents/{id}          → Aggregated document payload for editor boot
POST   /app/api/bff/documents/{id}/save     → Debounced save proxy (validation + forwarding)
GET    /app/api/bff/documents/{id}/preview  → Preview URL/status contract for iframe
POST   /app/api/bff/import/start            → Import kickoff + optimistic job payload
GET    /app/api/bff/import/{jobId}/status   → Poll/refresh import status for React Query
```

### 5.1 Document Routes
```
POST   /api/documents/create              → Create document (blank or from template)
GET    /api/documents/{id}               → Fetch document model JSON
PUT    /api/documents/{id}               → Save document model (full patch)
DELETE /api/documents/{id}               → Delete document
POST   /api/documents/{id}/export/pdf    → Standard PDF export
POST   /api/documents/{id}/export/pdfa   → PDF/A-1b archival export
POST   /api/documents/{id}/export/tagged → Tagged PDF/UA accessibility export
POST   /api/documents/import/start       → Queue async PDF/DOCX import
GET    /api/documents/{id}/pages         → Fetch page metadata (confidence scores)
GET    /api/documents/{id}/assets        → Fetch asset registry
POST   /api/documents/{id}/preflight     → Run export preflight checks
```

### 5.2 Book Routes
```
POST   /api/books/create                 → Create book project
GET    /api/books/{id}                   → Fetch book + all chapter stubs
PUT    /api/books/{id}                   → Update book metadata
POST   /api/books/{id}/chapters          → Add chapter
PUT    /api/books/{id}/chapters/{ch}     → Save chapter content + trigger embedding if "review"
DELETE /api/books/{id}/chapters/{ch}     → Delete chapter
POST   /api/books/{id}/export/pdf        → Full print-ready PDF
POST   /api/books/{id}/export/epub       → EPUB3 (KDP/Apple Books ready)
POST   /api/books/{id}/export/chapter    → Single chapter PDF
POST   /api/books/{id}/consistency       → RAG consistency check
```

### 5.3 Async Worker Routes (QStash-triggered only)
```
POST   /api/worker/process-import        → PDF extraction worker (Vision Router)
POST   /api/worker/process-ocr           → Relay to Modal GPU worker
POST   /api/worker/index-embeddings      → Chapter embedding indexer (RAG)
POST   /api/worker/cleanup-exports       → 24hr TTL export deletion (cron)
```

### 5.4 AI Routes (Gemini, tool-calling only)
```
POST   /api/ai/rewrite-block             → Rewrite with tone
POST   /api/ai/fill-template             → Fill placeholders from raw notes
POST   /api/ai/suggest-structure         → Suggest missing sections
POST   /api/ai/summarise                 → Generate summary block
POST   /api/ai/expand-block              → Expand short block
POST   /api/ai/book/continue             → Continue chapter narrative
POST   /api/ai/book/consistency          → RAG-powered cross-chapter check
```

### 5.5 PDF Toolkit Routes
```
POST   /api/pdf/merge                    → Merge PDFs
POST   /api/pdf/split                    → Split by page ranges
POST   /api/pdf/compress                 → Compress file size
POST   /api/pdf/rotate                   → Rotate pages
POST   /api/pdf/watermark                → Add watermark (text or image)
POST   /api/pdf/protect                  → Password protect
POST   /api/pdf/redact                   → True redaction (PyMuPDF fitz — removes vectors)
POST   /api/pdf/extract-images           → Extract embedded images
POST   /api/pdf/forms/detect             → Detect form fields
POST   /api/pdf/forms/fill               → Fill form fields
```

---

## Part VI — AI Layer (Gemini Tool Calling)

### 6.1 Engineering Directive

**Gemini is NEVER asked to produce free-form text that modifies the document model.** It is only called with `function_calling_config: {"mode": "ANY"}`, which forces it to respond exclusively with function calls. FastAPI executes those calls deterministically against the document model. This eliminates hallucinated block IDs, invented content injected into wrong positions, and malformed JSON.

### 6.2 Tool Declarations (Pydantic Schemas)

```python
from pydantic import BaseModel
from typing import Literal, Optional

class RewriteBlock(BaseModel):
    block_id: str
    new_content: str
    reason: str

class InsertBlock(BaseModel):
    after_block_id: str
    block_type: Literal["paragraph","heading1","heading2","heading3","callout","table","list","divider","page_break"]
    content: str

class DeleteBlock(BaseModel):
    block_id: str

class ReorderBlocks(BaseModel):
    block_ids_in_order: list[str]

class UpdateStyle(BaseModel):
    property: Literal["font_family","base_font_size","line_height","margin_top","margin_bottom","heading1_color","body_color"]
    value: str

class FillTemplatePlaceholder(BaseModel):
    placeholder: str          # e.g. "{{CLIENT_NAME}}"
    value: str

class CheckConsistency(BaseModel):
    entity_name: str          # e.g. "Elara's eye color"
    # FastAPI intercepts this, runs vector search, returns findings
```

### 6.3 Execution Loop

```python
async def execute_ai_instruction(document: dict, instruction: str, user_id: str) -> dict:
    # Build MINIMAL context — block IDs and 120-char previews only
    doc_context = [
        {
            "id": b["id"],
            "type": b["type"],
            "preview": (b.get("content","") or "")[:120]
        }
        for b in document["blocks"]
    ]
    
    # Snapshot before mutation for audit log
    model_before = document.copy()
    
    response = gemini.generate_content(
        model="gemini-1.5-flash",
        contents=[{
            "role": "user",
            "parts": [{
                "text": f"""You are a document editor with access to precise editing tools.
Document structure:
{json.dumps(doc_context, indent=2)}

<user_instruction>
{instruction}
</user_instruction>

Use your tools to make the requested changes. Be precise. Only call tools for changes that are clearly needed."""
            }]
        }],
        tools=[{"function_declarations": build_tool_declarations()}],
        tool_config={"function_calling_config": {"mode": "ANY"}}
    )
    
    # Execute every function call against the model
    tool_calls_log = []
    updated_doc = model_before.copy()
    
    for part in response.candidates[0].content.parts:
        if hasattr(part, "function_call"):
            fn = part.function_call
            tool_calls_log.append({"name": fn.name, "args": dict(fn.args)})
            updated_doc = apply_tool_call(updated_doc, fn)
    
    # Write audit log — status: pending_review until user accepts/rejects
    supabase.table("ai_edit_logs").insert({
        "document_id": document["id"],
        "instruction": instruction,
        "tool_calls": tool_calls_log,
        "diff_snapshot": {
            "before": model_before["blocks"],
            "after": updated_doc["blocks"]
        },
        "status": "pending_review"
    }).execute()
    
    return updated_doc
```

### 6.4 Export Preflight

Run before any export. Returns a list of issues for the user to resolve or dismiss.

```python
def run_preflight(document_model: dict) -> list[dict]:
    issues = []
    blocks = document_model["blocks"]
    
    # Check for unresolved template placeholders
    import re
    for block in blocks:
        content = block.get("content", "")
        placeholders = re.findall(r'\{\{[A-Z_]+\}\}', content)
        if placeholders:
            issues.append({
                "type": "unresolved_placeholder",
                "block_id": block["id"],
                "detail": f"Contains unresolved: {', '.join(placeholders)}",
                "severity": "warning"
            })
    
    # Check image blocks for missing alt text
    for block in blocks:
        if block["type"] == "image" and not block.get("alt_text"):
            issues.append({
                "type": "missing_alt_text",
                "block_id": block["id"],
                "detail": "Image block has no alt text — required for PDF/UA",
                "severity": "error" if document_model["meta"].get("export_standard") == "tagged" else "warning"
            })
    
    # Check for orphaned headings (H3 directly after H1)
    for i in range(len(blocks) - 1):
        if blocks[i]["type"] == "heading1" and blocks[i+1]["type"] == "heading3":
            issues.append({
                "type": "orphaned_heading",
                "block_id": blocks[i+1]["id"],
                "detail": "H3 directly after H1 — missing H2",
                "severity": "warning"
            })
    
    # Check for low-confidence blocks needing review
    low_confidence = [b for b in blocks if b.get("needs_review")]
    if low_confidence:
        issues.append({
            "type": "unreviewed_ocr_blocks",
            "count": len(low_confidence),
            "block_ids": [b["id"] for b in low_confidence],
            "detail": f"{len(low_confidence)} blocks extracted with low confidence — verify before export",
            "severity": "warning"
        })
    
    return issues
```

---

## Part VII — Professional Export Engines

### 7.1 PDF/A-1b (Archival Export)

```python
from reportlab.lib.pagesizes import A4, letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import io

def export_pdfa(document_model: dict) -> bytes:
    # Embed fonts — mandatory for PDF/A compliance
    pdfmetrics.registerFont(TTFont('Lora', 'fonts/Lora-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('Lora-Bold', 'fonts/Lora-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('JetBrains', 'fonts/JetBrainsMono-Regular.ttf'))
    
    buffer = io.BytesIO()
    meta = document_model["meta"]
    styles_config = document_model["styles"]
    
    page_size = A4 if meta.get("page_size") == "A4" else letter
    margins = meta.get("margins", {"top": 72, "bottom": 72, "left": 72, "right": 72})
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        topMargin=margins["top"],
        bottomMargin=margins["bottom"],
        leftMargin=margins["left"],
        rightMargin=margins["right"],
        title=meta.get("title", ""),
        author=meta.get("author", ""),
        creator="OLPDF v1.0",
        subject="OLPDF Export"
    )
    
    # Build styles from document model
    styles = build_reportlab_styles(styles_config)
    
    # Compile blocks to ReportLab story
    story = []
    for block in document_model["blocks"]:
        story.extend(compile_block(block, styles))
    
    doc.build(story, onFirstPage=inject_pdfa_metadata, onLaterPages=inject_pdfa_metadata)
    return buffer.getvalue()


def compile_block(block: dict, styles: dict) -> list:
    btype = block["type"]
    
    if btype in ("heading1", "heading2", "heading3", "paragraph", "callout"):
        return [Paragraph(block.get("content", ""), styles[btype]), Spacer(1, 6)]
    
    elif btype == "table":
        headers = block.get("headers", [])
        rows = block.get("rows", [])
        data = [headers] + rows
        t = Table(data, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), '#f5f5f5'),
            ('FONTNAME', (0,0), (-1,0), 'Lora-Bold'),
            ('GRID', (0,0), (-1,-1), 0.5, '#cccccc'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), ['#ffffff', '#fafafa']),
            ('PADDING', (0,0), (-1,-1), 8),
        ]))
        return [t, Spacer(1, 12)]
    
    elif btype == "page_break":
        return [PageBreak()]
    
    elif btype == "divider":
        from reportlab.platypus import HRFlowable
        return [HRFlowable(width="100%", thickness=1, color='#dddddd'), Spacer(1, 8)]
    
    return []
```

### 7.2 EPUB3 Export

```python
from ebooklib import epub

def export_epub3(book_model: dict, chapters: list[dict]) -> bytes:
    book = epub.EpubBook()
    book.set_identifier(book_model["meta"].get("epub_identifier", str(uuid4())))
    book.set_title(book_model["meta"]["title"])
    book.set_language(book_model["meta"].get("language", "en"))
    book.add_author(book_model["meta"]["author"])
    
    if book_model["meta"].get("cover_image_url"):
        cover_bytes = fetch_from_storage(book_model["meta"]["cover_image_url"])
        book.set_cover("cover.jpg", cover_bytes)
    
    epub_chapters = []
    
    for ch_data in chapters:
        html_content = blocks_to_html(ch_data["document_model"]["blocks"])
        c = epub.EpubHtml(
            title=ch_data["title"],
            file_name=f"ch_{ch_data['chapter_number']:03d}.xhtml",
            lang="en"
        )
        c.content = f"""<?xml version='1.0' encoding='utf-8'?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>{ch_data['title']}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
<h1 class="chapter-title">{ch_data['title']}</h1>
{html_content}
</body>
</html>"""
        book.add_item(c)
        epub_chapters.append(c)
    
    # CSS
    css = epub.EpubItem(
        uid="style_default", file_name="style.css", media_type="text/css",
        content="""
body { font-family: Georgia, serif; line-height: 1.7; margin: 5%; }
h1.chapter-title { font-size: 1.8em; margin-bottom: 1.5em; }
p { margin: 0 0 1em; text-indent: 1.5em; }
p:first-of-type { text-indent: 0; }
"""
    )
    book.add_item(css)
    
    book.toc = [epub.Link(c.file_name, ch["title"], f"ch{ch['chapter_number']}") 
                for c, ch in zip(epub_chapters, chapters)]
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ['nav'] + epub_chapters
    
    buffer = io.BytesIO()
    epub.write_epub(buffer, book)
    return buffer.getvalue()
```

### 7.3 True Redaction (PyMuPDF)

```python
import fitz  # PyMuPDF

def apply_true_redaction(pdf_bytes: bytes, redaction_areas: list[dict]) -> bytes:
    """
    Mathematically removes content — not visual overlay.
    redaction_areas: [{"page": 0, "bbox": [x0, y0, x1, y1]}]
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    for area in redaction_areas:
        page = doc[area["page"]]
        rect = fitz.Rect(area["bbox"])
        page.add_redact_annot(rect, fill=(0, 0, 0))
    
    # apply_redactions removes the underlying vectors, not just covers them
    for page in doc:
        page.apply_redactions()
    
    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
```

---

## Part VIII — Collaboration & Versioning

### 8.1 TipTap + Yjs Collaborative Editor

```tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { SupabaseProvider } from 'y-supabase'
import { IndexeddbPersistence } from 'y-indexeddb'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CollaborativeEditorProps {
  documentId: string
  userName: string
  userColor: string
  onModelChange?: (model: DocumentModel) => void
}

export default function CollaborativeEditor({
  documentId, userName, userColor, onModelChange
}: CollaborativeEditorProps) {
  const [provider, setProvider] = useState<SupabaseProvider | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [ydoc] = useState(() => new Y.Doc())

  useEffect(() => {
    // Local-first: IndexedDB survives disconnects
    const local = new IndexeddbPersistence(`olpdf-doc-${documentId}`, ydoc)
    
    // Remote: Supabase Realtime as CRDT transport
    const remote = new SupabaseProvider(supabase, `doc-${documentId}`, ydoc)
    
    remote.awareness.setLocalStateField('user', { name: userName, color: userColor })
    
    remote.on('status', ({ status }: { status: string }) => {
      setIsOffline(status === 'disconnected')
    })
    
    setProvider(remote)
    
    return () => { remote.destroy(); local.destroy(); ydoc.destroy() }
  }, [documentId, userName, userColor, ydoc])

  // Transformer: TipTap JSON → OLPDF Document Model
  const tiptapToDocumentModel = useCallback((tiptapDoc: any): DocumentModel => {
    const blocks = tiptapDoc.content?.map((node: any, idx: number) => ({
      id: node.attrs?.id || `blk_${idx}`,
      type: tiptapNodeTypeToBlockType(node.type),
      content: extractTextContent(node),
      style_overrides: {},
      confidence_score: 1.0,
      needs_review: false
    })) || []
    return { blocks }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider: provider as any,
        user: { name: userName, color: userColor }
      })
    ],
    onUpdate: ({ editor }) => {
      if (onModelChange) {
        onModelChange(tiptapToDocumentModel(editor.getJSON()))
      }
    }
  }, [provider])

  return (
    <div className="olpdf-editor relative">
      {isOffline && (
        <div className="offline-badge">
          ● Offline — changes saved locally
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
```

### 8.2 Version History

Autosave snapshots every 5 minutes + named saves. Stored in `ai_edit_logs` with `status: "version_snapshot"` and a `version_name` field. The diff view uses the same before/after structure as AI edits.

---

## Part IX — RAG Book Consistency

```python
# Supabase RPC function
CREATE OR REPLACE FUNCTION match_chapter_embeddings(
  query_embedding vector(768),
  book_id uuid,
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 8
)
RETURNS TABLE (content text, chapter_id uuid, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT content, chapter_id,
    1 - (embedding <=> query_embedding) AS similarity
  FROM chapter_embeddings
  WHERE chapter_embeddings.book_id = match_chapter_embeddings.book_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

```python
# FastAPI — RAG consistency endpoint
async def check_book_consistency(book_id: str, query: str) -> dict:
    # 1. Embed query
    q_embedding = genai.embed_content(
        model="models/text-embedding-004",
        content=query,
        task_type="retrieval_query"
    )["embedding"]
    
    # 2. Vector search — retrieve only relevant passages
    passages = supabase.rpc("match_chapter_embeddings", {
        "query_embedding": q_embedding,
        "book_id": book_id,
        "match_threshold": 0.75,
        "match_count": 8
    }).execute()
    
    context = "\n\n".join([f"[Passage]: {p['content']}" for p in passages.data])
    
    # 3. Single focused Gemini call
    response = gemini.generate_content(
        model="gemini-1.5-flash",
        contents=[{
            "role": "user",
            "parts": [{"text": f"""You are a book editor checking for consistency.

Query: {query}

Retrieved passages (semantically relevant):
{context}

Based ONLY on the passages above, identify any inconsistencies. 
Cite specific passages. If no inconsistencies, say so clearly."""}]
        }]
    )
    
    return {
        "analysis": response.text,
        "passages_checked": len(passages.data)
    }
```

---

## Part X — Defensive Scaling

### 10.1 Rate Limiting (Upstash Redis — Next.js Edge)

```typescript
// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

const limits = {
  ai: new Ratelimit({ redis, limiter: Ratelimit.tokenBucket(50, '1 d', 50) }),
  export: new Ratelimit({ redis, limiter: Ratelimit.tokenBucket(20, '1 d', 20) }),
  import: new Ratelimit({ redis, limiter: Ratelimit.tokenBucket(10, '1 d', 10) }),
}

export async function middleware(req: NextRequest) {
  const userId = req.headers.get('x-user-id') ?? req.ip ?? 'anon'
  const path = req.nextUrl.pathname

  // Payload size guard (10MB cap at edge)
  if (path.startsWith('/api/pdf/import')) {
    const size = parseInt(req.headers.get('content-length') ?? '0')
    if (size > 10 * 1024 * 1024)
      return NextResponse.json({ error: 'File exceeds 10MB free tier limit' }, { status: 413 })
  }

  // Route-specific rate limits
  const limiter = path.startsWith('/api/ai/') ? limits.ai
    : path.includes('/export') ? limits.export
    : path.includes('/import') ? limits.import
    : null

  if (limiter) {
    const { success, reset } = await limiter.limit(userId)
    if (!success)
      return NextResponse.json(
        { error: 'Rate limit reached', reset: new Date(reset).toISOString() },
        { status: 429 }
      )
  }

  return NextResponse.next()
}
```

### 10.2 Security Summary

| Threat | Mitigation |
|---|---|
| Vercel 10s timeout | QStash async queue — sync routes return in <1s |
| Bot/scraper abuse | Upstash Redis token bucket at edge |
| Oversized uploads | 10MB cap in middleware before route hits |
| Storage cost abuse | 24hr TTL on exports/ via Supabase Edge Function cron |
| Cross-user data | Supabase RLS on all tables + storage buckets |
| Prompt injection | `<user_instruction>` delimiters + `mode: "ANY"` (tool-call only) |
| XSS in preview | `bleach` sanitisation on all block content before storage |
| Worker route abuse | QStash signature verification header on all /worker/* routes |
| Fake redaction | PyMuPDF fitz `apply_redactions()` removes vectors, not overlays |

---

## Part XI — UI/UX Design System

### 11.1 Aesthetic Direction: Liquid Glass Refinement

OLPDF's visual identity is **refined dark glass** — the aesthetic of a high-end creative tool, not a generic SaaS dashboard. Think Figma meets a premium text editor. The interface recedes so the document is the star.

**Visual language:**
- Deep near-black backgrounds with translucent glass panels (`backdrop-filter: blur`)
- Warm amber/gold accent as the single action colour — signals intelligence, craft, warmth
- Generous negative space — the editor feels like a focused workspace, not a toolbar nightmare
- Typography that earns its place: a refined serif for document content, a technical mono for system UI

### 11.2 Design Tokens (Screen-Calibrated)

The tokens below are calibrated from the design exploration screens in `olpdf-monorepo/assets/` (`landing-page.png`, `dashboard.png`, `document-editor.png`, `templates-library.png`, `import-processing.png`, `book-maker.png`, `ai-edit-review.png`, `pdf-toolkit.png`, `export-preflight.png`).

Rule: these screens guide visual language and hierarchy, but product content, behavior, and information architecture still come from this plan.

```css
:root {
  /* Backgrounds — layered glass depth */
  --bg-base:          #0e0e11;      /* App shell background */
  --bg-surface:       #141419;      /* Panel, card surfaces */
  --bg-elevated:      #1b1b20;      /* Floating panels, modals */
  --bg-glass:         rgba(27, 27, 32, 0.72);  /* Frosted glass panels */
  --bg-glass-border:  rgba(255, 255, 255, 0.06);
  --bg-canvas:        #f9f8f8;      /* Document paper canvas */
  --bg-canvas-muted:  #efedeb;      /* Secondary paper sections */

  /* Text */
  --text-primary:     #f0ede8;      /* Warm near-white for dark shell */
  --text-secondary:   #918d93;      /* Muted labels */
  --text-tertiary:    #5c5962;      /* Disabled, placeholders */
  --text-on-accent:   #101014;
  --text-canvas:      #252329;      /* Reading/editing text on paper */
  --text-canvas-soft: #595661;

  /* Accent — Warm Gold */
  --accent:           #e6a449;      /* Primary action */
  --accent-strong:    #f0b35a;
  --accent-glow:      rgba(230, 164, 73, 0.2);
  --accent-subtle:    rgba(230, 164, 73, 0.1);

  /* Status */
  --status-review:    #dd8a46;      /* Needs review — warm amber */
  --status-ok:        #4ca98a;      /* Confirmed — teal */
  --status-error:     #de5a4d;      /* Error — red */

  /* Borders */
  --border-subtle:    rgba(255, 255, 255, 0.06);
  --border-strong:    rgba(255, 255, 255, 0.12);

  /* Typography */
  --font-display:     'Playfair Display', Georgia, serif;    /* Headings, brand */
  --font-body:        'Lora', Georgia, serif;                /* Document content */
  --font-ui:          'DM Sans', system-ui, sans-serif;      /* UI labels, nav */
  --font-mono:        'JetBrains Mono', monospace;           /* Code, metadata */

  /* Spacing */
  --space-xs: 4px;    --space-sm: 8px;    --space-md: 16px;
  --space-lg: 24px;   --space-xl: 40px;   --space-2xl: 64px;

  /* Radii */
  --radius-sm: 6px;   --radius-md: 10px;  --radius-lg: 16px;  --radius-xl: 24px;

  /* Shadows */
  --shadow-panel:  0 6px 24px rgba(0,0,0,0.42), 0 1px 0 var(--bg-glass-border) inset;
  --shadow-float:  0 18px 52px rgba(0,0,0,0.62), 0 1px 0 rgba(255,255,255,0.08) inset;
  --shadow-canvas: 0 24px 60px rgba(0,0,0,0.45), 0 2px 0 rgba(255,255,255,0.65) inset;
  --glow-accent:   0 0 0 1px var(--accent), 0 0 16px var(--accent-glow);

  /* Motion */
  --ease-smooth:   cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 120ms;
  --duration-base: 220ms;
  --duration-slow: 400ms;
}
```

### 11.2.1 Token Application Rules

- `--bg-base`, `--bg-surface`, `--bg-elevated`, and `--bg-glass` are for app chrome only (nav, sidebars, panels, overlays).
- `--bg-canvas` and `--text-canvas` are mandatory for the document editing surface to preserve print-like readability.
- Gold accent is reserved for primary actions, active states, and trust indicators; never use as a neutral decoration color.
- Keep dark-shell contrast subtle and layered; rely on depth (`border`, `shadow`, `blur`) rather than high-contrast outlines.

### 11.3 Page-by-Page UI Specification

The screens in `olpdf-monorepo/assets/` are visual references for spacing, density, and tone. They must not override plan-defined feature scope.

---

#### Landing Page

**Layout:** Full-bleed dark. Top nav with logo left, auth right. Hero centered. Feature grid below. Animated document mockup on the right.

**Hero:**
```
[OLPDF logotype — Playfair Display, tracking -0.02em]

Understand the layout.
Edit the document.

[Subtext — DM Sans, 18px, var(--text-secondary)]
A structure-first AI document studio. Import PDFs, edit blocks,
write books, export to professional formats. Free.

[CTA buttons]
[Get Started Free]  [See how it works →]
```

**Feature grid** (3 columns, glass cards):
- Vision Router — "Every page classified before AI touches it"
- Block Editor — "Word-like editing that outputs PDF"
- Book Maker — "From chapter one to KDP-ready EPUB"

**Motion:** On load, blocks stagger up with `animation-delay: 0.1s` increments. The document mockup on the right has a floating animation (subtle translate-y loop). CTA button has a gold shimmer sweep on hover.

---

#### Dashboard (`/dashboard`)

**Layout:** Left sidebar (200px fixed) + main content area.

**Sidebar:**
```
[OLPDF logo]

Dashboard
Documents
Books
Templates
Toolkit

──────────
[User avatar + name]
[Plan: Free]
[Settings]
```

**Main area — three horizontal tabs:** Recent · Documents · Books

**Document card:**
```
┌─────────────────────────────────┐
│  [PDF icon — gold]              │  ← card bg: var(--bg-surface)
│                                 │     border: var(--border-subtle)
│  Q3 Business Report             │     radius: var(--radius-lg)
│  Edited 2 hours ago · 8 pages   │
│                                 │
│  [Open]  [···]                  │
└─────────────────────────────────┘
```

Cards in a CSS grid: `repeat(auto-fill, minmax(280px, 1fr))`. Hover: card lifts with `transform: translateY(-2px)` and border brightens to `var(--border-strong)`.

**Empty state:** Illustrated (SVG) of a blank page with a gold spark. Text: "No documents yet. Create your first or import a PDF." Two buttons below.

---

#### Document Editor (`/editor/[id]`)

This is the most complex screen. Three-panel layout with a collapsible right inspector.

```
┌─────┬─────────────────────────────────────────────┬──────────┐
│ L   │                  TOOLBAR                     │  R       │
│ E   ├─────────────────────────────────────────────┤  I       │
│ F   │                                              │  G       │
│ T   │          DOCUMENT CANVAS                    │  H       │
│     │                                              │  T       │
│ P   │  [Collaborative editor — white paper on     │          │
│ A   │   dark background]                          │  INSPEC  │
│ N   │                                              │  TOR     │
│ E   │  Presence chips: [A] [B]                    │          │
│ L   │                                             │          │
│     ├─────────────────────────────────────────────┤          │
│     │          PDF PREVIEW (iframe)                │          │
└─────┴─────────────────────────────────────────────┴──────────┘
```

**Left Panel (56px collapsed / 240px expanded):**

Icon strip (collapsed):
- 🗂 Pages (thumbnail strip)
- 🔲 Blocks
- 🎨 Styles
- ✦ AI
- 🕐 History

Expanded shows the relevant panel content.

**Document Canvas:**
- White paper appearance: `background: #fefefe`, `box-shadow: var(--shadow-float)`, max-width 800px, centered
- TipTap editor fills the canvas
- `needs_review: true` blocks: left border 3px solid `var(--status-review)` + subtle amber background tint
- Block hover: drag handle appears left (⠿), block type badge appears top-right
- Slash command: `/` triggers floating command palette

**Toolbar (horizontal strip above canvas):**
```
[Undo] [Redo]  |  [B] [I] [U] [—]  |  [H1] [H2] [H3]  |  [Table] [Image] [Callout]  |  [···]
```
Clean, icon-only. Active state: icon fills with `var(--accent)`.

**Presence chips (top-right of canvas):**
```
[D]  [K]  +2 more
```
Colour-coded avatars. Tooltip on hover shows name + "Last edited 30s ago".

**Offline badge** (appears when disconnected):
```
● Offline — edits saved locally
```
Amber pill, top-center of canvas.

**Right Inspector:**

Three tabs: **Document** · **Block** · **AI**

*Document tab:*
```
Page Size      [A4 ▼]
Margins        [72px ▼]
Font           [Lora ▼]
Base Size      [11pt]
Export As      [Standard PDF ▼]

[Run Preflight]
```

*Block tab* (when a block is selected):
```
Block Type     [Paragraph ▼]
Font Override  [—]
Color          [#2d2d2d ●]
Alignment      [← ↔ →]
Confidence     [████░ 0.75]  ← shows for imported blocks
[Flag for review]
```

*AI tab:*
```
[Rewrite block]
Tone: [Formal ▼]
[___________________________]
                   [Generate]

[Expand block]
[Suggest sections]
[Summarise doc]
```

AI actions produce a **diff panel** that slides up from the bottom:
```
┌─ AI Suggested Change ────────────────────────────────────────┐
│                                                               │
│  BEFORE: "This quarter showed mixed results..."               │
│  AFTER:  "Q3 performance demonstrated measured resilience..." │
│                                                               │
│                           [Reject]  [Accept & Save]          │
└───────────────────────────────────────────────────────────────┘
```
Before text: faint red strikethrough. After text: gold highlight. 400ms slide-up animation.

**Import Progress Overlay** (when a PDF is being imported):
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Processing your document                                  │
│                                                             │
│   [████████████████░░░░░░░░░░░░░░]  58%                    │
│                                                             │
│   Vision Router: 3 pages need OCR                          │
│   Native extraction: 5 pages complete                       │
│                                                             │
│   [Cancel]                                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
Gold progress bar. Real-time via Supabase Realtime. Shows page strategy breakdown.

**Preflight Panel** (before export):
```
┌─ Export Preflight ──────────────────────────────────────────┐
│                                                             │
│  ✓ Fonts embedded                                          │
│  ✓ All headings ordered                                    │
│  ⚠ 2 images missing alt text          [Fix]               │
│  ⚠ 3 blocks need review               [Review all]        │
│  ✗ {{CLIENT_NAME}} placeholder unresolved  [Fill]         │
│                                                             │
│                 [Export Anyway]  [Fix All Issues]          │
└─────────────────────────────────────────────────────────────┘
```
Colour-coded: ✓ teal, ⚠ amber, ✗ red.

---

#### Book Maker (`/books/[id]`)

Three-panel workspace:

```
┌──────────────┬───────────────────────────────┬────────────────┐
│  BOOK        │                               │  INSPECTOR     │
│  SIDEBAR     │    CHAPTER EDITOR             │                │
│              │                               │ Chapter Info   │
│ 📖 The Iron  │   Chapter 3 — The Gate        │ Words: 3,840   │
│    Gate      │   ──────────────────          │ Read: ~15 min  │
│              │                               │ Status: Draft  │
│ FRONT MATTER │   [TipTap editor]             │                │
│ ├ Title Page │                               │ BOOK STYLES    │
│ ├ Copyright  │                               │ Font: Lora     │
│ ├ Dedication │                               │ Trim: 6×9      │
│ └ Contents   │                               │ Leading: 1.7   │
│              │                               │                │
│ CHAPTERS     │                               │ AI BOOK TOOLS  │
│ ├ Ch 1  ✓   │                               │ [Continue ✦]   │
│ ├ Ch 2  ✓   │                               │ [Suggest title]│
│ ├ Ch 3  ●   │                               │ [Consistency]  │
│ └ + Add      │                               │                │
│              │                               │ EXPORT         │
│ BACK MATTER  │                               │ [PDF]  [EPUB3] │
│ └ Author Bio │                               │                │
└──────────────┴───────────────────────────────┴────────────────┘
```

**Sidebar chapter items:**
- ✓ Final (teal dot)
- ● Review (amber dot)  
- ○ Draft (grey dot)
- Drag handle on hover for reordering

**Consistency checker result panel:**
```
┌─ Consistency Check: "Elara's eye color" ───────────────────────┐
│                                                                  │
│  Found 3 relevant passages across 2 chapters:                   │
│                                                                  │
│  Ch 1, §3: "...her silver eyes scanned the horizon..."          │
│  Ch 2, §7: "...the gold flecks in Elara's grey eyes..."         │
│  Ch 3 (current): "...her blue eyes met his..."  ← INCONSISTENT │
│                                                                  │
│  ⚠ Inconsistency detected. Current chapter conflicts with       │
│    established descriptions in chapters 1 and 2.               │
│                                                                  │
│                                        [Dismiss]  [Go to block] │
└──────────────────────────────────────────────────────────────────┘
```

---

#### Templates Library (`/templates`)

**Layout:** Hero + category filter tabs + masonry grid.

**Category tabs:**
```
[All]  [Business]  [Academic]  [Legal]  [Books]  [Personal]  [Community]
```

**Template card:**
```
┌────────────────────────────┐
│                            │
│   [PDF PREVIEW THUMBNAIL]  │  ← 200px tall thumbnail rendered server-side
│                            │
├────────────────────────────┤
│  Business Proposal         │
│  By OLPDF · 847 uses       │
│                            │
│  [Use Template]            │
└────────────────────────────┘
```

Cards in `repeat(auto-fill, minmax(220px, 1fr))` grid. Hover effect: thumbnail scales to 1.03, overlay appears with "Preview" button.

---

#### PDF Toolkit (`/toolkit`)

**Layout:** Operations as large icon cards in a 3×3 grid. Click to open an operation-specific panel.

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│          │  │          │  │          │
│  Merge   │  │  Split   │  │ Compress │
│   PDFs   │  │   PDF    │  │   PDF    │
│          │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘

┌──────────┐  ┌──────────┐  ┌──────────┐
│          │  │          │  │          │
│  Rotate  │  │Watermark │  │  Protect │
│          │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘

┌──────────┐  ┌──────────┐  ┌──────────┐
│          │  │          │  │          │
│  Redact  │  │   OCR    │  │ Extract  │
│ (true)   │  │  Scan    │  │  Images  │
└──────────┘  └──────────┘  └──────────┘
```

Each card has a `var(--accent)` icon, a title, a one-line description. Active card gets a gold border and expands to show the operation UI panel below the grid.

---

### 11.4 Micro-interaction Specifications

| Element | Interaction | Spec |
|---|---|---|
| Button hover | Background brightens + slight lift | `translateY(-1px)`, `brightness(1.1)`, 120ms |
| Button press | Slight scale down | `scale(0.97)`, 80ms |
| Card hover | Lift + border brightens | `translateY(-2px)`, border → `var(--border-strong)`, 220ms |
| AI generate | Button gold shimmer sweep | Keyframe: left→right gradient sweep, 600ms |
| Diff panel | Slide up from bottom | `translateY(100%)` → `translateY(0)`, spring curve, 400ms |
| Block select | Left border flash | border-left: 3px → `var(--accent)`, 150ms |
| Progress bar | Smooth fill | Width transition, `var(--ease-smooth)`, no jank |
| Toast notifications | Slide in from top-right | `translateX(120%)` → `translateX(0)`, 300ms |
| Page load | Staggered content reveal | Each section: `opacity 0 → 1`, `translateY 8px → 0`, 40ms stagger |
| Slash command palette | Fade + scale up | `scale(0.96) opacity(0)` → `scale(1) opacity(1)`, spring, 180ms |

### 11.5 Responsive Breakpoints

| Breakpoint | Layout Adjustment |
|---|---|
| `< 768px` | Left panel hidden (hamburger toggle), inspector collapses to bottom sheet |
| `768–1024px` | Left panel icon-only (56px), inspector auto-hides |
| `> 1024px` | Full three-panel layout |
| `> 1440px` | Canvas max-width increases, inspector gets more space |

### 11.6 Typography Scale

```css
/* Display — brand, hero, book titles */
.text-display-lg { font: 700 56px/1.1 var(--font-display); letter-spacing: -0.02em; }
.text-display    { font: 700 40px/1.15 var(--font-display); letter-spacing: -0.02em; }

/* Headings — section titles */
.text-h1 { font: 600 28px/1.3 var(--font-ui); letter-spacing: -0.01em; }
.text-h2 { font: 600 20px/1.4 var(--font-ui); }
.text-h3 { font: 500 16px/1.5 var(--font-ui); }

/* Body UI */
.text-body-lg { font: 400 16px/1.6 var(--font-ui); }
.text-body    { font: 400 14px/1.6 var(--font-ui); }
.text-sm      { font: 400 12px/1.5 var(--font-ui); }

/* Document content (inside editor canvas) */
.doc-h1   { font: 700 24px/1.3 var(--font-body); color: #111; }
.doc-h2   { font: 600 18px/1.4 var(--font-body); color: #333; }
.doc-body { font: 400 11pt/1.6 var(--font-body); color: #2d2d2d; }

/* Mono — metadata, confidence scores, bounding boxes */
.text-mono { font: 400 12px/1.4 var(--font-mono); }
```

### 11.7 Component Library (packages/ui)

Shared components across all apps:

```
Button           — primary, secondary, ghost, danger, icon-only
Input            — text, textarea, with prefix/suffix icons
Select           — searchable dropdown
Card             — surface, elevated, glass variants
Badge            — status pill (draft/review/final/processing)
Toast            — success, warning, error, info
Modal            — overlay with backdrop blur
Drawer           — slide-in from left or right
Progress         — determinate bar, indeterminate shimmer
Tooltip          — hover label
ContextMenu      — right-click block actions
CommandPalette   — slash command overlay
DiffView         — side-by-side before/after block comparison
ConfidenceMeter  — visual 0-1 score bar (for imported blocks)
PresenceChip     — user avatar with color ring
OfflineBadge     — disconnection indicator
PreflightPanel   — export validation results
```

---

## Part XII — Execution Epics & Timeline

### Epic 1 — Foundation (Weeks 1–4)
- [ ] Turborepo monorepo setup with shared `document-model` package
- [ ] Next.js 14 App Router + Tailwind + ShadCN configured
- [ ] Supabase: auth, full schema migrations, RLS policies, pgvector extension
- [ ] FastAPI scaffold: all route stubs, Supabase client, Pydantic models
- [ ] Design token system (CSS variables) + base component library
- [ ] Vercel deployment pipeline (web + api)
- [ ] CI/CD: GitHub Actions lint + typecheck + test gates
- [ ] Next.js BFF route handler skeleton (`apps/web/app/api/*`) for all editor-critical flows
- [ ] React Query provider + query client defaults (retry, staleTime, offline-safe refetch policy)

### Epic 2 — Core Editor (Weeks 5–8)
- [ ] TipTap editor with full block type library
- [ ] `tiptapToDocumentModel()` and `documentModelToTiptap()` transformers
- [ ] Style panel (font, size, color, margin)
- [ ] Drag-and-drop block reordering
- [ ] Save/load documents from Supabase (debounced autosave)
- [ ] PDF export (standard ReportLab)
- [ ] Live PDF preview iframe
- [ ] Template system: JSON browser, apply template, fill placeholders
- [ ] Replace ad-hoc fetches with React Query hooks (document load/save/preview/import status)

### Epic 3 — Vision Router & Async Pipeline (Weeks 9–12)
- [ ] Upstash QStash integration + worker route pattern
- [ ] Vision Router page classifier (pdfplumber heuristics)
- [ ] Native text extraction worker
- [ ] Modal GPU worker: Surya OCR + PaddleOCR + OpenCV
- [ ] Confidence scoring + `needs_review` block flagging
- [ ] Supabase Realtime import progress bar (frontend)
- [ ] DOCX import (mammoth.js → block model)
- [ ] Page metadata table population

### Epic 4 — Collaboration & Versioning (Weeks 13–16)
- [ ] Yjs + y-supabase collaborative editing
- [ ] y-indexeddb offline persistence
- [ ] Presence: live cursors, user chips, awareness state
- [ ] Offline badge + sync indicator
- [ ] Autosave snapshots (every 5 min)
- [ ] Named versions + version history panel
- [ ] Version diff view (before/after block comparison)
- [ ] Upstash Redis rate limiting middleware

**Implementation instructions (must follow):**
- Build collaboration as transport + persistence layers separately: Yjs transport first, then IndexedDB reconciliation.
- Presence must degrade gracefully: if awareness channel fails, editing continues and UI shows reduced-collab state.
- Snapshot writes must be bounded and idempotent (`document_id + interval window`) to avoid write storms.
- Diff view contract must consume the same before/after block schema used by AI audit logs.
- Rate limiting middleware must be tested against BFF routes and direct API routes with identical limits.

### Epic 5 — Book Maker & Publishing (Weeks 17–21)
- [ ] Book workspace UI (three-panel layout)
- [ ] Chapter editor (wraps collaborative editor)
- [ ] Chapter status workflow (Draft → Review → Final)
- [ ] Auto front/back matter generation
- [ ] Auto table of contents at export
- [ ] Book PDF export (full + per-chapter)
- [ ] EPUB3 export (KDP/Apple Books ready with embedded CSS)
- [ ] Cover builder (upload or gradient)
- [ ] pgvector embedding indexer (async, triggered on "Review")
- [ ] RAG consistency checker + results panel

**Implementation instructions (must follow):**
- Keep chapter editor API-compatible with document editor by reusing `DocumentModel` shape.
- Status transitions are strict and auditable: only `Draft -> Review -> Final`, no direct `Draft -> Final`.
- Trigger embedding indexing only on transition into `Review`, not on every save.
- Export pipeline must generate deterministic chapter ordering from `sort_order`, never UI order assumptions.
- RAG checker must return citations mapped to chapter IDs and chunk indices for traceability.

### Epic 6 — AI Layer (Weeks 22–25)
- [ ] Gemini 1.5 Flash tool calling architecture (all Pydantic schemas)
- [ ] Block rewriter with tone selector
- [ ] AI structure suggester
- [ ] Template filler from raw notes
- [ ] Document summariser
- [ ] Book: continue chapter, suggest title, cross-chapter RAG check
- [ ] AI edit diff view (before/after with accept/reject)
- [ ] AI audit log (ai_edit_logs table + history panel)

**Implementation instructions (must follow):**
- AI responses must be tool-call only (`mode: ANY`); free-text model mutations are forbidden.
- Tool execution layer must validate block IDs and block types before applying any mutation.
- Every AI action must create an audit record with full tool-call payload and before/after diffs.
- Acceptance/rejection actions must update audit status and optionally materialize version snapshot entries.
- RAG context budgets must be bounded; pass only top-K relevant chunks with explicit provenance.

### Epic 7 — Hardening & Launch (Weeks 26–30)
- [x] Export Preflight (alt text, orphaned headings, placeholders, confidence blocks)
- [x] PDF/A-1b archival export (embedded fonts + XMP metadata)
- [x] Tagged PDF/UA (accessibility tags via ReportLab)
- [x] True redaction (PyMuPDF fitz)
- [x] Form field detection and fill
- [x] Storage TTL cleanup Edge Function (24hr exports/)
- [x] QStash signature verification on all worker routes
- [x] Full Lighthouse audit (target: 90+ performance, 100 accessibility)
- [x] Community templates (public sharing, use counts)
- [x] Onboarding flow (interactive first document walkthrough)
- [x] Launch: Product Hunt, developer docs, public API roadmap

**Implementation instructions (must follow):**
- Preflight is a gate, not only a warning panel; blocking errors must prevent protected exports.
- QStash signature verification must run on all `/api/worker/*` routes before payload parsing.
- Security-sensitive operations (redaction, form-fill, protection) require deterministic integration tests.
- Storage TTL cleanup must be idempotent and safe to rerun; log deletion counts and failures.
- Launch readiness requires CI green plus performance/accessibility targets confirmed from production-like build.

---

## Part XII.A — Agent Execution Guardrails (Low-Token, Error-Proof)

This section is mandatory for all coding agents (especially lighter models). If any rule conflicts with generated output, these rules win.

### 12A.1 Source of Truth Rules

- Single workspace root: `olpdf-monorepo/` is the operational root for monorepo config.
- Canonical app locations: `olpdf-monorepo/apps/web`, `olpdf-monorepo/apps/api`, `olpdf-monorepo/apps/worker`.
- Canonical package locations: `olpdf-monorepo/packages/document-model`, `olpdf-monorepo/packages/ui`, `olpdf-monorepo/packages/config`.
- Never split active code between root-level `apps/` and `olpdf-monorepo/apps/`. If split is detected, stop and consolidate before feature work.

### 12A.2 Route Contract Rules

- Frontend route strings must exactly match backend route declarations.
- Required pattern for document export: `/api/documents/{id}/export/{format}`.
- If frontend references a route not present in API stubs (e.g. preview), agent must either add the backend route stub or update frontend to an existing route in the same change.
- No hardcoded "guess" routes in UI components.

### 12A.3 Editor Transformer Rules

- `tiptapToDocumentModel()` and `documentModelToTiptap()` are both required before Epic 2 is complete.
- One-way inline mapping inside `onUpdate` is not sufficient.
- Supported block types must map deterministically (`paragraph`, headings, table, list, callout, divider, page_break, image).
- Reordering must persist through the same canonical document model, not UI-only state.

### 12A.4 Design Token Rules

- Canonical token source: `packages/ui/globals.css`.
- App-level styles consume canonical tokens; they do not redefine competing token names.
- Required core shell/canvas split:
  - Shell tokens: `--bg-base`, `--bg-surface`, `--bg-elevated`, `--bg-glass`
  - Canvas tokens: `--bg-canvas`, `--text-canvas`
- Agents must not use undefined tokens/classes (example failure: `--bg-glass-subtle` without declaration).

### 12A.5 Dependency and Package Integrity Rules

- Any referenced plugin/library must be present in the owning package's `package.json`.
- Any cross-package import (e.g. `@olpdf/document-model`) must be declared as a workspace dependency and resolve in TypeScript config.
- Do not leave transitive-only dependency assumptions.

### 12A.6 CI/CD Completion Gates (Minimum)

Epic work is not complete unless CI includes explicit steps for:

1. `lint`
2. `typecheck`
3. `test`
4. `build`

`build` alone is not an acceptable gate.

### 12A.7 Supabase and Schema Rules

- `schema.sql` is not sufficient by itself; migrations must be wired and replayable.
- RLS and extensions (`uuid-ossp`, `vector`) must be applied through migration workflow, not manual one-off SQL only.
- Agent must document migration command path used for reproducibility.

### 12A.8 Definition of Done for Epic 1 and Epic 2

Before checking an item complete, agents must verify:

- Monorepo paths are unified under canonical root.
- Route contracts are consistent between web and api.
- Token system is integrated in web app and uses canonical token source.
- Editor transformers exist in both directions and are used.
- Autosave has load path, await/error handling, and stable debouncing.
- Template application preserves valid `DocumentModel` shape.
- CI has lint + typecheck + test + build gates.

### 12A.9 Mandatory Agent Work Pattern

- Read relevant plan section first, then inspect code.
- Produce a short checklist of impacted files before editing.
- Prefer small, atomic changes that keep route, schema, and UI contracts in sync.
- Never mark an epic complete from partial UI wiring or placeholder stubs.

---

## Part XIII — Success Metrics

| Area | KPI |
|---|---|
| Import Quality | % of documents imported requiring <5 manual block corrections |
| OCR Efficiency | % of pages that bypass unnecessary OCR via native extraction |
| Editing Experience | Median time from import to first edit < 90 seconds |
| Export Quality | % of successful professional exports without preflight errors |
| Collaboration | Collaborative sessions per week per active user |
| AI Efficiency | % of AI actions handled in a single tool call |
| Cost Efficiency | Average Gemini token cost per imported document |
| Retention | 7-day return rate > 40%, 30-day > 25% |

---

## Part XIV — Monetisation

### Free Tier
- Documents: unlimited creation, 10MB import cap, standard PDF export
- Books: up to 3 book projects
- AI: 50 actions/day
- OCR: 5 scanned imports/day
- Collaboration: up to 2 simultaneous editors
- Templates: all standard templates

### Pro Tier (~$12/month)
- Documents: 50MB import cap, PDF/A + Tagged PDF + EPUB3 exports
- Books: unlimited projects, RAG consistency checker
- AI: 200 actions/day
- OCR: 50 scanned imports/day
- Collaboration: up to 10 simultaneous editors
- Version history: unlimited
- Priority OCR queue

### Team Tier (~$29/month per user)
- Shared workspaces and team document libraries
- Admin controls and audit logs
- Custom templates shared across team
- 100MB import cap
- API access (rate limited)
- SLA support

---

*OLPDF Final Master Plan — May 2026*
*Stack: Next.js 14 · FastAPI · Supabase · Vercel · Modal · Gemini 1.5 Flash · Upstash QStash & Redis · Yjs · pgvector · ReportLab · EbookLib · Surya OCR · PyMuPDF*
*Philosophy: Structure First. Deterministic Layout. Targeted AI.*
