-- 036_agent_integration.sql
-- Sprint 6: Multi-store AI agent integration boundary

-- Agent API keys — scoped, auditable access for external AI systems
CREATE TABLE IF NOT EXISTS agent_api_keys (
    id              SERIAL PRIMARY KEY,
    key_hash        TEXT NOT NULL UNIQUE,       -- bcrypt hash of the API key
    name            TEXT NOT NULL,              -- e.g. "Store-42 Engagement Agent"
    scopes          TEXT NOT NULL DEFAULT '',   -- comma-separated: 'read:engagement', 'write:replies', 'read:products', 'write:drafts'
    stores          TEXT NOT NULL DEFAULT '',   -- comma-separated store IDs this agent can access (empty = all)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    rate_limit_rpm  INTEGER NOT NULL DEFAULT 60, -- requests per minute allowed
    last_used_at    TIMESTAMP WITH TIME ZONE,
    created_by      TEXT NOT NULL DEFAULT 'admin',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for all agent actions
CREATE TABLE IF NOT EXISTS agent_audit_log (
    id              SERIAL PRIMARY KEY,
    agent_key_id    INTEGER REFERENCES agent_api_keys(id),
    action          TEXT NOT NULL,              -- e.g. 'read_engagement', 'submit_reply_draft', 'read_metrics'
    resource_type   TEXT NOT NULL DEFAULT '',  -- 'engagement_event', 'social_post', 'product'
    resource_id     TEXT NOT NULL DEFAULT '',   -- primary key of affected resource
    request_payload TEXT,                      -- JSON of request (truncated if large)
    response_status INTEGER,                   -- HTTP status code
    ip_address      TEXT,
    user_agent      TEXT,
    duration_ms     INTEGER,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent-submitted drafts (goes to admin outbox for approval)
CREATE TABLE IF NOT EXISTS agent_content_submissions (
    id              SERIAL PRIMARY KEY,
    agent_key_id    INTEGER REFERENCES agent_api_keys(id),
    submission_type TEXT NOT NULL,             -- 'reply_draft' | 'social_post_draft' | 'blog_idea'
    platform        TEXT,                      -- for social posts: 'facebook', 'instagram', etc.
    content         TEXT NOT NULL,             -- the draft content
    context_json    TEXT,                      -- e.g. {"engagement_event_id": 123, "original_comment": "..."}
    status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
    reviewed_by     TEXT,
    reviewed_at     TIMESTAMP WITH TIME ZONE,
    notes           TEXT,                      -- admin notes on review
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for agent queries
CREATE INDEX IF NOT EXISTS idx_agent_audit_agent_time
    ON agent_audit_log (agent_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_submissions_status
    ON agent_content_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_submissions_agent
    ON agent_content_submissions (agent_key_id, created_at DESC);
