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
