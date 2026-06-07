-- 037_admin_audit_sentiment.sql
-- Comprehensive audit logging + sentiment analysis + social listening

-- Admin action audit log (separate from agent audit)
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id              SERIAL PRIMARY KEY,
    admin_email     TEXT NOT NULL,
    action          TEXT NOT NULL,              -- 'publish_post', 'approve_draft', 'update_persona', etc.
    resource_type   TEXT NOT NULL DEFAULT '',  -- 'social_post', 'persona', 'product', etc.
    resource_id     TEXT NOT NULL DEFAULT '',
    old_values      TEXT,                      -- JSON of what changed (for updates)
    new_values      TEXT,                      -- JSON of new values
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_time
    ON admin_audit_log (admin_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_resource
    ON admin_audit_log (resource_type, resource_id);

-- Sentiment tracking on engagement events
ALTER TABLE social_engagement_events ADD COLUMN IF NOT EXISTS sentiment_score REAL;  -- -1.0 to 1.0
ALTER TABLE social_engagement_events ADD COLUMN IF NOT EXISTS sentiment_label TEXT;  -- 'negative' | 'neutral' | 'positive'
ALTER TABLE social_engagement_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Social listening: tracked keywords/phrases (competitors, trends, brand mentions)
CREATE TABLE IF NOT EXISTS social_listening_keywords (
    id              SERIAL PRIMARY KEY,
    keyword         TEXT NOT NULL,              -- e.g. "@competitor", "#trend", "brand name"
    keyword_type    TEXT NOT NULL DEFAULT 'mention',  -- 'mention' | 'hashtag' | 'competitor' | 'trend'
    priority        INTEGER NOT NULL DEFAULT 1, -- 1-5, higher = more important
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    match_count_24h INTEGER DEFAULT 0,          -- cached count updated periodically
    last_match_at   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crisis alerts (auto-flagged viral negative content)
CREATE TABLE IF NOT EXISTS crisis_alerts (
    id              SERIAL PRIMARY KEY,
    alert_type      TEXT NOT NULL,              -- 'viral_negative' | 'spam_attack' | 'misinformation'
    severity        TEXT NOT NULL,              -- 'low' | 'medium' | 'high' | 'critical'
    platform        TEXT NOT NULL,
    platform_post_id TEXT,
    description     TEXT NOT NULL,
    engagement_count INTEGER,                   -- how many comments/likes at time of alert
    sentiment_score REAL,
    is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by     TEXT,
    resolved_at     TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crisis_alerts_unresolved
    ON crisis_alerts (is_resolved, severity, created_at DESC);

-- Team roles & permissions (RBAC for human team members)
CREATE TABLE IF NOT EXISTS admin_team_members (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'content_creator',  -- 'admin' | 'content_creator' | 'approver' | 'analyst' | 'viewer'
    permissions     TEXT NOT NULL DEFAULT '',   -- comma-separated overrides
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RBAC Permissions reference (not a table, just documentation of available perms)
-- social:read, social:write, social:publish, social:approve
-- persona:read, persona:write
-- analytics:read
-- settings:read, settings:write
-- agents:manage

-- Content performance predictions (store ML predictions vs actuals)
CREATE TABLE IF NOT EXISTS content_predictions (
    id              SERIAL PRIMARY KEY,
    social_post_id  INTEGER REFERENCES social_posts(id),
    predicted_reach INTEGER,
    predicted_engagement INTEGER,
    predicted_ctr   REAL,                      -- click-through rate
    confidence      REAL,                      -- 0.0 to 1.0
    actual_reach    INTEGER,                   -- filled in after post runs
    actual_engagement INTEGER,
    actual_ctr      REAL,
    accuracy_delta  REAL,                      -- how off was the prediction
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Revenue attribution (connect social posts to sales)
CREATE TABLE IF NOT EXISTS social_revenue_attribution (
    id              SERIAL PRIMARY KEY,
    social_post_id  INTEGER REFERENCES social_posts(id),
    utm_campaign    TEXT NOT NULL,
    order_id        INTEGER REFERENCES orders(id),
    revenue_cents   INTEGER NOT NULL,           -- attributed revenue
    attribution_model TEXT NOT NULL DEFAULT 'last_click',  -- 'first_click' | 'last_click' | 'linear'
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_social_revenue_post
    ON social_revenue_attribution (social_post_id, created_at);
