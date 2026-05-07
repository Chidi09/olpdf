# OLPDF — Open Layout PDF

> **Structure First. Deterministic Layout. Targeted AI.**

OLPDF is an open-source, structure-first AI document studio. It classifies every page of a PDF before touching it, extracts a semantic block model, lets you edit with Gemini AI, and exports to PDF/A, Tagged PDF, or EPUB3.

---

## What It Does

| Capability | How |
|---|---|
| **Smart PDF Import** | Vision Router classifies each page — native text, scanned, table-heavy, image-heavy — and routes to the cheapest reliable extractor |
| **Block Editor** | TipTap-based editor turns the extracted block model into a Word-like editing surface |
| **AI Editing** | Gemini 1.5 Flash uses tool-calling only (`mode: ANY`) — no free-text mutations, fully auditable |
| **Book Maker** | Multi-chapter workspace with RAG consistency checker, EPUB3 + print PDF export |
| **PDF Toolkit** | Merge, split, compress, rotate, watermark, protect, redact, extract images, detect/fill forms |
| **Professional Exports** | Standard PDF, PDF/A-1b (archival), Tagged PDF (accessibility), EPUB3 (KDP/Apple Books) |
| **Collaboration** | Yjs CRDT + Supabase Realtime for real-time multiplayer editing; IndexedDB for offline |

---

## Open-Source Core Engine
The `olpdf` core engine is now open-source. It includes high-fidelity PDF extraction, the `DocumentModel` JSON specification, and the ReportLab export pipeline.

### Contribute
We welcome contributions to the core engine. See `CONTRIBUTING.md` for details on setting up the local environment and submitting PRs.
- `apps/api/engine/` contains the core extraction and export logic.
- `packages/document-model/` contains the structural spec.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TipTap, Yjs, TanStack Query, Tailwind v4 |
| Backend | FastAPI (Python), Pydantic v2 |
| Database | Supabase (PostgreSQL + pgvector + RLS) |
| Storage | Cloudflare R2 (S3-compatible, zero egress) |
| Queue | Upstash QStash (async job dispatch) |
| Rate Limiting | Upstash Redis |
| GPU Worker | Modal (Surya OCR, PaddleOCR, OpenCV) |
| AI | Gemini 1.5 Flash (tool-calling) + text-embedding-004 (RAG) |
| Email | Resend (or any SMTP) |
| Monorepo | Turborepo + pnpm |
| Deployment | Vercel (web + api), Modal (worker) |

---

## Monorepo Structure

```
olpdf-monorepo/
├── apps/
│   ├── web/          # Next.js 15 frontend
│   ├── api/          # FastAPI backend
│   └── worker/       # Modal GPU worker (Surya OCR, PaddleOCR)
├── packages/
│   ├── document-model/   # Shared Zod (TS) + Pydantic (Python) schemas
│   ├── ui/               # Shared React component library
│   └── config/           # ESLint, Tailwind, TypeScript base configs
├── schema.sql            # Supabase schema (run via migrations)
├── supabase/             # Supabase migration files
└── docker-compose.yml    # Local dev: Supabase + Redis emulator
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Python 3.11+
- A [Supabase](https://supabase.com) project
- A [Cloudflare R2](https://www.cloudflare.com/products/r2/) bucket
- A [Gemini API key](https://aistudio.google.com/)

### 1. Clone & install

```bash
git clone https://github.com/your-org/olpdf.git
cd olpdf-monorepo
pnpm install
```

### 2. Set environment variables

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**`apps/api/.env`**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_BUCKET_NAME=olpdf-storage

GEMINI_API_KEY=your-gemini-key

QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-qstash-signing-key
QSTASH_NEXT_SIGNING_KEY=your-qstash-next-signing-key
MODAL_WORKER_URL=https://your-modal-endpoint.modal.run

# Email (pick one)
RESEND_API_KEY=re_your_resend_key
# or
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=user@example.com
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM=noreply@olpdf.xyz

APP_URL=https://olpdf.xyz

# Local development only
OLPDF_DEV_MODE=true
```

### 3. Apply the database schema

```bash
# Using Supabase CLI
supabase db push

# Or manually paste schema.sql into the Supabase SQL editor
```

Enable the required extensions in Supabase:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
```

### 4. Run locally

```bash
# All apps in parallel
pnpm dev

# Or individually:
pnpm --filter web dev          # http://localhost:3000
pnpm --filter api dev          # http://localhost:8000
```

---

## API Reference

### Documents

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/documents/create` | Create a blank document |
| `GET` | `/api/documents/{id}` | Fetch document model |
| `PUT` | `/api/documents/{id}` | Save document model |
| `DELETE` | `/api/documents/{id}` | Delete document |
| `POST` | `/api/documents/import/start` | Queue async PDF/DOCX import |
| `GET` | `/api/documents/import/{jobId}/status` | Poll import progress |
| `POST` | `/api/documents/{id}/export/{format}` | Export (standard \| pdf_a \| tagged) |
| `POST` | `/api/documents/{id}/preflight` | Run export preflight checks |
| `POST` | `/api/documents/{id}/snapshot` | Save a named version |
| `GET` | `/api/documents/{id}/versions` | List version history |

### Books

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/books/create` | Create book project |
| `GET` | `/api/books/{id}` | Fetch book + chapter stubs |
| `POST` | `/api/books/{id}/chapters` | Add a chapter |
| `PUT` | `/api/books/{id}/chapters/{ch}` | Save chapter (triggers embedding on → review) |
| `POST` | `/api/books/{id}/export/{format}` | Export book (pdf \| epub) |
| `POST` | `/api/books/{id}/consistency` | RAG cross-chapter consistency check |

### AI

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/ai/documents/{id}/instruction` | Run a natural-language edit instruction |
| `GET` | `/api/ai/documents/{id}/logs` | Fetch AI audit log |
| `POST` | `/api/ai/logs/{id}/accept` | Accept AI edit (writes to document) |
| `POST` | `/api/ai/logs/{id}/reject` | Reject AI edit |

### PDF Toolkit

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/pdf/merge` | Merge multiple PDFs |
| `POST` | `/api/pdf/split` | Split by page ranges |
| `POST` | `/api/pdf/compress` | Compress & deflate |
| `POST` | `/api/pdf/rotate` | Rotate pages |
| `POST` | `/api/pdf/watermark` | Add diagonal text watermark |
| `POST` | `/api/pdf/protect` | AES-256 password encryption |
| `POST` | `/api/pdf/redact` | True redaction (removes vectors) |
| `POST` | `/api/pdf/extract-images` | Extract all embedded images |
| `POST` | `/api/pdf/forms-detect` | Detect form fields |
| `POST` | `/api/pdf/forms-fill` | Fill form fields |

All routes require `Authorization: Bearer <supabase-jwt>`.
Worker routes (`/api/worker/*`) require a valid QStash signature instead.

---

## Document Model

Every document is stored as a JSON block tree. Both the frontend (TypeScript/Zod) and backend (Python/Pydantic) share the same schema from `packages/document-model`.

```json
{
  "meta": { "title": "...", "author": "...", "page_size": "A4" },
  "styles": { "font_family": "Lora", "body": { "size": 11 } },
  "blocks": [
    {
      "id": "blk_uuid",
      "type": "heading1",
      "content": "Executive Summary",
      "confidence_score": 0.98,
      "needs_review": false
    }
  ]
}
```

Block types: `paragraph` · `heading1` · `heading2` · `heading3` · `callout` · `table` · `list` · `divider` · `page_break` · `image`

Blocks with `confidence_score < 0.80` are automatically flagged `needs_review: true` and highlighted in the editor.

---

## Vision Router

The Vision Router classifies each PDF page before any extraction runs:

| Page Type | Signal | Strategy |
|---|---|---|
| Native text | >80% text coverage | `pdfplumber` direct extraction |
| Scanned | <20% text, high image ratio | Surya OCR + layout reconstruction |
| Table-heavy | ≥2 tables detected | PaddleOCR table extractor |
| Image-heavy | >60% image pixels | OpenCV region extraction |
| Cover / blank | Single image or empty | Preserve / skip |

Native pages are extracted synchronously. Scanned pages are dispatched to the Modal GPU worker via QStash and merged back when OCR completes.

---

## AI Layer

Gemini is **only** called with `function_calling_config: { mode: "ANY" }`. It never produces free-text that modifies documents — every change goes through a validated tool call:

- `RewriteBlock` — rewrite a block's content
- `InsertBlock` — insert a new block after a given block ID
- `DeleteBlock` — delete a block by ID
- `ReorderBlocks` — reorder the full block list
- `UpdateStyle` — update a document style property

Every AI action creates an audit record in `ai_edit_logs` with a before/after diff. Edits are in `pending_review` status until the user accepts or rejects them.

---

## Email Notifications

OLPDF sends transactional emails at key moments:

| Event | Template |
|---|---|
| PDF import complete | "Your document is ready to edit" |
| Import partial (OCR queued) | "Partial import complete — OCR in progress" |
| Export ready | "Your PDF/A export is ready — link expires in 24h" |

Configure via `RESEND_API_KEY` (recommended) or `SMTP_*` environment variables. In development, set `OLPDF_DEV_MODE=true` to log emails instead of sending.

---

## Security

| Threat | Control |
|---|---|
| Unauthenticated API access | JWT Bearer verification on all `/api/*` routes |
| Worker route abuse | QStash HMAC signature on all `/api/worker/*` |
| Cross-user data access | Supabase RLS on all tables |
| Oversized uploads | 10 MB payload cap in FastAPI middleware |
| XSS in block content | `bleach.clean()` before persistence |
| Prompt injection | `<user_instruction>` delimiters + tool-call-only mode |
| Fake redaction | PyMuPDF `apply_redactions()` removes underlying vectors |
| Export file abuse | 24-hour TTL cron on `exports/` storage bucket |
| Plaintext password exposure | AES-256 encryption for protected PDFs |

---

## Development Commands

```bash
pnpm dev            # Run all apps
pnpm build          # Build all apps
pnpm lint           # Lint all packages
pnpm typecheck      # TypeScript check all packages
pnpm test           # Run all test suites
```

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feature/my-feature`
2. Make your changes following the patterns in this repo
3. Ensure `pnpm lint && pnpm typecheck && pnpm test` all pass
4. Open a pull request with a clear description

See `/contribute` in the app for more details.

---

## License

MIT — free for personal and commercial use.

---

*OLPDF · May 2026 · Structure First. Deterministic Layout. Targeted AI.*
