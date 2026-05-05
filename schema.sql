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
    status TEXT DEFAULT 'pending_review', -- 'pending_review' | 'accepted' | 'rejected' | 'version_snapshot'
    document_model JSONB,               -- Stored for version snapshots
    version_name TEXT,                  -- Name for a user-saved version
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
