-- Enable RLS and policies on all application tables.

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_edit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own documents" ON documents;
CREATE POLICY "Users own documents"
ON documents FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own books" ON books;
CREATE POLICY "Users own books"
ON books FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own chapters via books" ON book_chapters;
CREATE POLICY "Users own chapters via books"
ON book_chapters FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM books
    WHERE books.id = book_chapters.book_id
      AND books.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM books
    WHERE books.id = book_chapters.book_id
      AND books.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users own templates" ON templates;
CREATE POLICY "Users own templates"
ON templates FOR ALL
USING (creator_id = auth.uid() OR is_public = true)
WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Users own ai logs via documents" ON ai_edit_logs;
CREATE POLICY "Users own ai logs via documents"
ON ai_edit_logs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = ai_edit_logs.document_id
      AND documents.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = ai_edit_logs.document_id
      AND documents.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users own page metadata via documents" ON page_metadata;
CREATE POLICY "Users own page metadata via documents"
ON page_metadata FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = page_metadata.document_id
      AND documents.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = page_metadata.document_id
      AND documents.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users own assets via documents" ON assets;
CREATE POLICY "Users own assets via documents"
ON assets FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = assets.document_id
      AND documents.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = assets.document_id
      AND documents.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users own chapter embeddings via books" ON chapter_embeddings;
CREATE POLICY "Users own chapter embeddings via books"
ON chapter_embeddings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM books
    WHERE books.id = chapter_embeddings.book_id
      AND books.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM books
    WHERE books.id = chapter_embeddings.book_id
      AND books.user_id = auth.uid()
  )
);
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
-- Migration: 20260506140000_api_keys.sql
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own API keys" ON api_keys;
CREATE POLICY "Users can manage their own API keys"
ON api_keys FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
-- Migration: 20260506160000_phase3_enterprise.sql

-- 1. Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own webhooks" ON webhooks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);

-- 2. E-Signatures
CREATE TABLE IF NOT EXISTS signature_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- pending, completed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage signature requests" ON signature_requests FOR ALL USING (auth.uid() = requester_id);
CREATE INDEX IF NOT EXISTS idx_sig_req_doc ON signature_requests(document_id);

CREATE TABLE IF NOT EXISTS signature_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES signature_requests(id) ON DELETE CASCADE,
    signer_email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    signed_at TIMESTAMPTZ,
    signature_data TEXT,
    ip_address TEXT,
    user_agent TEXT
);

ALTER TABLE signature_fields ENABLE ROW LEVEL SECURITY;
-- Signers need to access their field via the token, which bypasses normal RLS (handled by service role in API)
CREATE POLICY "Public read/update signature fields via token" ON signature_fields FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_sig_fields_token ON signature_fields(token);
CREATE INDEX IF NOT EXISTS idx_sig_fields_req ON signature_fields(request_id);

-- 3. Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    plan TEXT DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace owners manage their workspaces" ON workspaces FOR ALL USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS workspace_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'commenter')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own memberships" ON workspace_users FOR SELECT USING (auth.uid() = user_id);

-- Update documents to support workspaces
ALTER TABLE documents ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- 4. Forms
CREATE TABLE IF NOT EXISTS form_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL, -- text, email, date, select, signature
    is_required BOOLEAN DEFAULT false,
    options JSONB, -- For select fields
    bounding_box FLOAT[] NOT NULL,
    page_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage form fields for their documents" ON form_fields FOR ALL
    USING (EXISTS (SELECT 1 FROM documents WHERE documents.id = document_id AND documents.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    signer_id UUID REFERENCES profiles(id), -- Optional, for authenticated signers
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Document owners see submissions" ON form_submissions FOR SELECT
    USING (EXISTS (SELECT 1 FROM documents WHERE documents.id = document_id AND documents.user_id = auth.uid()));

-- 5. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    workspace_id UUID REFERENCES workspaces(id),
    resource_id TEXT NOT NULL,
    resource_type TEXT NOT NULL, -- document, book, workspace, key
    action TEXT NOT NULL, -- created, updated, deleted, exported, signed
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace admins see audit logs" ON audit_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM workspace_users WHERE workspace_users.workspace_id = audit_logs.workspace_id AND workspace_users.user_id = auth.uid() AND workspace_users.role IN ('owner', 'admin')));
-- Migration: 20260506190000_phase3_hardening.sql

-- API key hardening: scopes + active state
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT '{}';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Webhook delivery observability
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    attempt_count INTEGER DEFAULT 1
);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read webhook deliveries for owned webhooks"
ON webhook_deliveries FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM webhooks
        WHERE webhooks.id = webhook_deliveries.webhook_id
        AND webhooks.user_id = auth.uid()
    )
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at DESC);
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
-- Phase 4 Ecosystem: Plugin SDK Marketplace + White-label Tenants

-- ============================================================
-- PLUGINS
-- ============================================================

CREATE TABLE IF NOT EXISTS plugins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    slug            TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) <= 60),
    description     TEXT NOT NULL CHECK (char_length(description) <= 1000),
    manifest        JSONB NOT NULL,
    bundle_url      TEXT NOT NULL CHECK (bundle_url LIKE 'https://%' AND char_length(bundle_url) <= 2000),
    version         TEXT NOT NULL CHECK (version ~ '^\d+\.\d+\.\d+$'),
    category        TEXT NOT NULL CHECK (char_length(category) <= 50),
    is_published    BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    installs        BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plugins_author      ON plugins(author_id);
CREATE INDEX IF NOT EXISTS idx_plugins_category    ON plugins(category) WHERE is_published;
CREATE INDEX IF NOT EXISTS idx_plugins_installs    ON plugins(installs DESC) WHERE is_published;
CREATE INDEX IF NOT EXISTS idx_plugins_slug        ON plugins(slug);

CREATE TRIGGER trg_plugins_updated_at
    BEFORE UPDATE ON plugins
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- WORKSPACE PLUGINS
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_plugins (
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    plugin_id       UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    installed_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    locked_version  TEXT,
    installed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, plugin_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_plugins_workspace ON workspace_plugins(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_plugins_plugin    ON workspace_plugins(plugin_id);

-- ============================================================
-- INCREMENT INSTALLS RPC (atomic)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_plugin_installs(plugin_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
    UPDATE plugins SET installs = installs + 1 WHERE id = plugin_id;
$$;

-- ============================================================
-- TENANTS (White-label)
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    slug            TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) <= 60),
    name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    custom_domain   TEXT UNIQUE CHECK (char_length(custom_domain) <= 255),
    -- Branding
    logo_url        TEXT CHECK (logo_url IS NULL OR logo_url LIKE 'https://%'),
    primary_color   TEXT CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9a-fA-F]{6}$'),
    accent_color    TEXT CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-fA-F]{6}$'),
    favicon_url     TEXT CHECK (favicon_url IS NULL OR favicon_url LIKE 'https://%'),
    -- Feature flags
    features        JSONB NOT NULL DEFAULT '{}',
    -- Plan
    plan            TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner         ON tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_slug          ON tenants(slug);

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TENANT MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_members (
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE plugins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members    ENABLE ROW LEVEL SECURITY;

-- plugins: anyone can read published; author can manage own
CREATE POLICY "plugins_select_published" ON plugins
    FOR SELECT USING (is_published OR author_id = auth.uid());

CREATE POLICY "plugins_insert_own" ON plugins
    FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "plugins_update_own" ON plugins
    FOR UPDATE USING (author_id = auth.uid());

-- workspace_plugins: workspace members can read; admins can install/uninstall
CREATE POLICY "workspace_plugins_select" ON workspace_plugins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_plugins.workspace_id
              AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY "workspace_plugins_insert" ON workspace_plugins
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_plugins.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "workspace_plugins_delete" ON workspace_plugins
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_plugins.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'admin')
        )
    );

-- tenants: owner + members can read; owner can manage
CREATE POLICY "tenants_select" ON tenants
    FOR SELECT USING (
        owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.tenant_id = tenants.id AND tm.user_id = auth.uid())
    );

CREATE POLICY "tenants_insert_own" ON tenants
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "tenants_update_own" ON tenants
    FOR UPDATE USING (owner_id = auth.uid());

-- tenant_members: tenant admins/owners can manage
CREATE POLICY "tenant_members_select" ON tenant_members
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM tenants t WHERE t.id = tenant_members.tenant_id AND t.owner_id = auth.uid()
        )
    );

CREATE POLICY "tenant_members_insert" ON tenant_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM tenants t WHERE t.id = tenant_members.tenant_id AND t.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM tenant_members tm
            WHERE tm.tenant_id = tenant_members.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "tenant_members_delete" ON tenant_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM tenants t WHERE t.id = tenant_members.tenant_id AND t.owner_id = auth.uid()
        )
    );
-- Per-user AI provider configuration and encrypted key storage
CREATE TABLE IF NOT EXISTS user_ai_settings (
    user_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    provider          TEXT NOT NULL DEFAULT 'gemini_free',
    model             TEXT,
    encrypted_api_key TEXT,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_settings_owner" ON user_ai_settings
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
