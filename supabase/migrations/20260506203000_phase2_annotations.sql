-- Migration: 20260506203000_phase2_annotations.sql

CREATE TABLE IF NOT EXISTS annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    page_number INTEGER NOT NULL DEFAULT 1,
    position JSONB NOT NULL DEFAULT '{}'::jsonb,
    content TEXT NOT NULL,
    annotation_type TEXT NOT NULL DEFAULT 'comment',
    parent_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
    resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_annotations_document_id ON annotations(document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_parent_id ON annotations(parent_id);

ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read annotations on owned docs"
ON annotations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM documents
        WHERE documents.id = annotations.document_id
          AND documents.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert annotations on owned docs"
ON annotations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM documents
        WHERE documents.id = annotations.document_id
          AND documents.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update annotations on owned docs"
ON annotations FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM documents
        WHERE documents.id = annotations.document_id
          AND documents.user_id = auth.uid()
    )
);
