# OLPDF — Open Layout PDF

> **Structure First. Deterministic Layout. Targeted AI.**

OLPDF is an open-source, structure-first AI document studio. It classifies every page of a PDF, extracts a semantic block model, lets you edit with any major AI provider, and exports to PDF/A, Tagged PDF, or EPUB3.

**Live:** [olpdf.xyz](https://olpdf.xyz) · **Docs:** [olpdf.xyz/docs](https://olpdf.xyz/docs)

---

## What It Does

| Capability | How |
|---|---|
| **Smart PDF Import** | Vision Router classifies each page — native text, scanned, image-heavy — routes to PyMuPDF or Gemini Vision OCR inline |
| **Block Editor** | TipTap-based editor turns the semantic block model into a Word-like editing surface with real-time collaboration |
| **Multi-Provider AI** | Bring your own key for Claude, GPT, DeepSeek, Kimi, or Gemini — or use the free Gemini 2.5 Flash tier |
| **Embed SDK** | Drop the full editor into any web app in 3 lines via `@olpdf/embed` — React, Svelte, Vue, Nuxt, Astro, Angular, Wix, WordPress, .NET/WebView2 |
| **Book Maker** | Multi-chapter workspace with RAG consistency checker, EPUB3 + print PDF export |
| **PDF Toolkit** | Merge, split, compress, rotate, watermark, protect, redact, extract images, detect/fill forms |
| **Professional Exports** | Standard PDF, PDF/A-1b (archival), Tagged PDF (accessibility), EPUB3 (KDP/Apple Books) |
| **Plugin Marketplace** | Install community plugins per workspace; enterprise version locking pins the exact version at install time |
| **Collaboration** | Yjs CRDT + Supabase Realtime Presence for real-time multiplayer editing; IndexedDB for offline |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TipTap, Yjs, TanStack Query, Tailwind v4 |
| Backend | FastAPI (Python), Pydantic v2 |
| Database | Supabase (PostgreSQL + pgvector + RLS) |
| Storage | Cloudflare R2 (S3-compatible, zero egress) |
| Queue | Upstash QStash (export cleanup cron only) |
| Rate Limiting | Upstash Redis |
| AI — OCR | Gemini 2.5 Flash Vision (inline, replaces GPU worker) |
| AI — Editing | Claude, GPT-4, DeepSeek, Kimi, Gemini — user-configurable per account |
| AI — RAG | `text-embedding-004` (Gemini) for book consistency checks |
| Email | Resend (or any SMTP) |
| Monorepo | Turborepo + pnpm |
| Deployment | Vercel (web + api) |

---

## Monorepo Structure

```
olpdf-monorepo/
├── apps/
│   ├── web/              # Next.js 16 frontend
│   └── api/              # FastAPI backend
├── packages/
│   ├── document-model/   # Shared Zod (TS) + Pydantic (Python) schemas
│   ├── olpdf-embed/      # @olpdf/embed — vanilla JS embed SDK
│   ├── olpdf-react/      # @olpdf/react — React / Next.js component
│   ├── olpdf-svelte/     # @olpdf/svelte — Svelte / SvelteKit component
│   ├── olpdf-vue/        # @olpdf/vue   — Vue 3 / Nuxt component
│   ├── olpdf-py/         # olpdf        — Python SDK (PyPI)
│   ├── olpdf-rs/         # olpdf        — Rust crate (crates.io)
│   ├── olpdf-go/         # olpdf-go     — Go module (pkg.go.dev)
│   ├── olpdf-dotnet/     # Olpdf        — C# NuGet package
│   ├── ui/               # Shared React component library
│   └── config/           # ESLint, Tailwind, TypeScript base configs
├── supabase/migrations/  # Incremental database migrations
└── schema.sql            # Full schema snapshot
```

---

## Getting Started

### Prerequisites

- Node.js 20+, pnpm 10+
- Python 3.11+
- A [Supabase](https://supabase.com) project
- A [Cloudflare R2](https://www.cloudflare.com/products/r2/) bucket
- A [Gemini API key](https://aistudio.google.com/) (free tier works)

### 1. Clone & install

```bash
git clone https://github.com/Chidi09/olpdf.git
cd olpdf-monorepo
pnpm install
```

### 2. Set environment variables

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**`apps/api/.env`**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_BUCKET_NAME=olpdf-documents

GEMINI_API_KEY=your-gemini-key

# Email (pick one)
RESEND_API_KEY=re_your_resend_key
# or SMTP_HOST / SMTP_PORT / SMTP_USERNAME / SMTP_PASSWORD
EMAIL_FROM=noreply@olpdf.xyz
APP_URL=https://olpdf.xyz

# Export cleanup cron (QStash)
QSTASH_CURRENT_SIGNING_KEY=your-qstash-signing-key

# Local development
OLPDF_DEV_MODE=true
```

### 3. Apply migrations

```bash
supabase db push
```

Enable required Postgres extensions:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
```

### 4. Run locally

```bash
pnpm dev                       # All apps in parallel
pnpm --filter web dev          # http://localhost:3000
pnpm --filter api dev          # http://localhost:8000
```

---

## Embed SDK

Drop the full OLPDF editor into any web app:

```bash
npm install @olpdf/embed
```

```js
import { OlPDFEmbed } from '@olpdf/embed';

const editor = new OlPDFEmbed(container, {
  host: 'https://olpdf.xyz',
  documentId: 'doc_abc123',
  token: userToken,
});

editor.on('MODEL_UPDATE', ({ documentModel }) => myDB.save(documentModel));
```

### Framework packages

| Package | Install | Usage |
|---|---|---|
| `@olpdf/react` | `npm i @olpdf/react` | `<OlpdfEditor documentId token onModelUpdate />` |
| `@olpdf/svelte` | `npm i @olpdf/svelte` | `<OlpdfEditor {documentId} {token} />` |
| `@olpdf/vue` | `npm i @olpdf/vue` | `<OlpdfEditor document-id token @model-update />` |

For Astro, Angular, Wix, and WordPress see [olpdf.xyz/docs#embed-frameworks](https://olpdf.xyz/docs#embed-frameworks).

### SDK packages (other languages)

| Language | Package | Registry |
|---|---|---|
| Python | `pip install olpdf` | PyPI |
| Rust | `cargo add olpdf` | crates.io |
| Go | `go get github.com/Chidi09/olpdf/packages/olpdf-go` | pkg.go.dev |
| .NET | `dotnet add package Olpdf` | NuGet |

---

## API Reference

All routes require `Authorization: Bearer <api_key_or_jwt>`.

### Documents

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/documents/create` | Create a blank document |
| `GET` | `/api/documents/{id}` | Fetch document model |
| `PUT` | `/api/documents/{id}` | Save document model |
| `DELETE` | `/api/documents/{id}` | Delete document |
| `POST` | `/api/documents/import/start` | Import a PDF (inline Gemini Vision OCR for scanned pages) |
| `GET` | `/api/documents/import/{id}/status` | Poll import progress |
| `POST` | `/api/documents/{id}/export/{format}` | Export (`standard` \| `pdf_a` \| `tagged` \| `epub`) |
| `POST` | `/api/documents/{id}/snapshot` | Save a named version |
| `GET` | `/api/documents/{id}/versions` | List version history |

### AI

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/ai/documents/{id}/instruction` | Natural-language edit (tool-call only, fully auditable) |
| `GET` | `/api/ai/documents/{id}/logs` | Fetch AI audit log |
| `POST` | `/api/ai/logs/{id}/accept` | Accept AI edit |
| `POST` | `/api/ai/logs/{id}/reject` | Reject AI edit |
| `GET` | `/api/ai-settings` | Get current AI provider + model |
| `PUT` | `/api/ai-settings` | Set provider, model, and encrypted API key |
| `DELETE` | `/api/ai-settings/key` | Clear key and revert to free Gemini tier |

### PDF Toolkit

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/pdf/merge` | Merge multiple PDFs |
| `POST` | `/api/pdf/split` | Split by page ranges |
| `POST` | `/api/pdf/rotate` | Rotate pages |
| `POST` | `/api/pdf/watermark` | Add text watermark |
| `POST` | `/api/pdf/protect` | AES-256 password encryption |
| `POST` | `/api/pdf/redact` | True redaction (removes underlying vectors) |
| `POST` | `/api/pdf/extract-images` | Extract embedded images |
| `POST` | `/api/pdf/forms-detect` | Detect form fields |
| `POST` | `/api/pdf/forms-fill` | Fill form fields |

### Books, Plugins, Workspaces

See [olpdf.xyz/docs](https://olpdf.xyz/docs) for the full Books, Plugin Marketplace, Workspace, Webhook, Signature, and Tenant API references.

---

## Document Model

Both TypeScript (Zod) and Python (Pydantic) share the same schema from `packages/document-model`.

```json
{
  "meta": { "title": "...", "author": "...", "page_size": "A4" },
  "styles": { "font_family": "Lora", "base_font_size": 11 },
  "blocks": [
    {
      "id": "blk_uuid",
      "type": "heading1",
      "content": "Executive Summary",
      "rich_spans": [{ "text": "Executive Summary", "bold": true }],
      "confidence_score": 0.98,
      "needs_review": false,
      "page_index": 0,
      "column_index": 0
    }
  ],
  "page_dimensions": [{ "page_index": 0, "width": 595, "height": 842 }]
}
```

Block types: `paragraph` · `heading1` · `heading2` · `heading3` · `callout` · `table` · `list` · `divider` · `page_break` · `image`

---

## Vision Router

Classifies each PDF page before extraction:

| Page Type | Signal | Strategy |
|---|---|---|
| Native text | >80% text coverage | PyMuPDF direct extraction |
| Table-heavy | ≥2 tables detected | pdfplumber table extractor |
| Scanned / image-heavy | <20% text, >50% image | **Gemini 2.5 Flash Vision** (inline, concurrent) |

Scanned pages are rendered to PNG via PyMuPDF and sent to Gemini concurrently (`asyncio.gather` + semaphore). No external GPU worker or job queue required.

---

## AI Layer

All document edits go through validated tool calls — Gemini/Claude/GPT is **never** given free-text write access to a document:

| Tool | What it does |
|---|---|
| `RewriteBlock` | Rewrite a block's content (clears rich_spans for re-render) |
| `InsertBlock` | Insert a new block, healing the AST linked list |
| `DeleteBlock` | Delete a block, healing prev/next pointers |
| `ReorderBlocks` | Reorder all blocks, rebuilding the full chain |
| `UpdateStyle` | Update a document-level style property |

Every action creates an `ai_edit_logs` record with a before/after diff. Edits stay `pending_review` until accepted or rejected.

Users can bring their own API key for any supported provider via **Settings → AI Engine**. Keys are encrypted at rest (AES-256/Fernet) and never returned in API responses.

---

## Security

| Threat | Control |
|---|---|
| Unauthenticated API access | JWT Bearer verification on all `/api/*` routes |
| Export cleanup abuse | QStash HMAC on `/api/worker/cleanup-exports` |
| Cross-user data access | Supabase RLS on all tables |
| Oversized uploads | 10 MB payload cap in FastAPI middleware |
| XSS in block content | `bleach.clean()` before persistence |
| Prompt injection | `<user_instruction>` delimiters + tool-call-only mode |
| Fake redaction | PyMuPDF `apply_redactions()` removes underlying vectors |
| Export file abuse | 24-hour TTL cron on `exports/` bucket |
| Stored API keys | AES-256/Fernet encryption, hash stored only |

---

## Publishing SDK Packages

Each SDK package publishes automatically when you push a version tag:

| Package | Tag format | Registry |
|---|---|---|
| `@olpdf/embed` | `embed/v0.1.0` | npm |
| `@olpdf/react` | `react/v0.1.0` | npm |
| `@olpdf/svelte` | `svelte/v0.1.0` | npm |
| `@olpdf/vue` | `vue/v0.1.0` | npm |
| `olpdf` (Python) | `py/v0.1.0` | PyPI |
| `olpdf` (Rust) | `rs/v0.1.0` | crates.io |
| `olpdf-go` | `packages/olpdf-go/v0.1.0` | pkg.go.dev |
| `Olpdf` (.NET) | `dotnet/v0.1.0` | NuGet |

Required secrets: `NPM_TOKEN`, `CRATES_IO_TOKEN`, `NUGET_API_KEY`. PyPI uses GitHub OIDC Trusted Publisher (no token needed).

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
2. Follow the patterns in this repo
3. Ensure `pnpm lint && pnpm typecheck && pnpm test` pass
4. Open a pull request with a clear description

See [/contribute](https://olpdf.xyz/contribute) in the app for more details.

---

## License

MIT — free for personal and commercial use.

---

*OLPDF · May 2026 · Structure First. Deterministic Layout. Targeted AI.*
