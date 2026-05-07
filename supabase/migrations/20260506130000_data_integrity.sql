-- Track E: Data Integrity and Constraints

-- 1. Add error column to page_metadata for per-page tracking
ALTER TABLE page_metadata ADD COLUMN IF NOT EXISTS error TEXT;

-- 2. Add unique constraint to page_metadata to prevent duplicate rows per page
-- This helps with idempotency of the import pipeline
ALTER TABLE page_metadata ADD CONSTRAINT unique_page_per_doc UNIQUE (document_id, page_number);

-- 3. Audit Logs Table for privileged operations
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,               -- 'delete_document', 'export_pdf', 'change_plan'
    resource_type TEXT NOT NULL,        -- 'document', 'book', 'user'
    resource_id TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_edit_logs_doc_id ON ai_edit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_page_metadata_doc_id ON page_metadata(document_id);

-- 5. Plan-based constraints (placeholders for business logic enforcement in DB)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS document_count_limit INTEGER DEFAULT 10;
