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
