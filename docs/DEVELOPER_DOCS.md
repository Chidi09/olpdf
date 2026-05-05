# OLPDF Developer Documentation

## Architecture Overview
OLPDF is a structure-first AI document operating system.
- **Frontend:** Next.js 14 App Router, TipTap Editor, Yjs CRDTs.
- **Backend:** FastAPI (Vercel Python), Supabase (Auth, DB, Storage).
- **Worker:** Modal GPU Worker for OCR and layout extraction.

## Core Data Model
The `DocumentModel` is the single source of truth, shared between TypeScript and Python. It consists of `blocks`, `styles`, and `meta`.

## AI Strategy
Gemini 1.5 Flash is used via function calling (`mode: ANY`). AI never directly mutates the document; it suggests tool calls that must be reviewed and accepted by the user.

## RAG Consistency
RAG uses `text-embedding-004` and `pgvector`. Consistency checks return provenance (chapter_id, chunk_index) for all findings.

## Professional Exports
- **PDF/A-1b:** Archival standard with embedded fonts and XMP metadata.
- **Tagged PDF/UA:** Accessibility standard with structural tagging.
- **EPUB3:** KDP/Apple Books ready reflowable format.

## Security
- **QStash:** Signature verification on all async worker routes.
- **True Redaction:** Mathematical removal of content using PyMuPDF.
- **Rate Limiting:** Upstash Redis at the Next.js Edge.
