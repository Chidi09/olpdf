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
