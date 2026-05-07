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
