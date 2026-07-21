-- 044_social_connections.sql
-- Provider-agnostic social OAuth connection layer.

CREATE TABLE IF NOT EXISTS social_connections (
    id SERIAL PRIMARY KEY,
    brand_id TEXT NOT NULL DEFAULT 'default',
    provider TEXT NOT NULL,
    account_type TEXT NOT NULL,
    display_name TEXT,
    external_account_id TEXT NOT NULL,
    external_user_id TEXT,
    encrypted_access_token TEXT,
    encrypted_refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    refresh_token_expires_at TIMESTAMP WITH TIME ZONE,
    scopes TEXT,
    metadata TEXT,
    status TEXT NOT NULL DEFAULT 'connected',
    last_error TEXT,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    connected_by_user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (brand_id, provider, account_type, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_connections_provider_status
    ON social_connections(provider, status);

CREATE INDEX IF NOT EXISTS idx_social_connections_external_account
    ON social_connections(provider, external_account_id);

CREATE TABLE IF NOT EXISTS social_oauth_states (
    id SERIAL PRIMARY KEY,
    state_hash TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    brand_id TEXT NOT NULL DEFAULT 'default',
    admin_user_id TEXT,
    return_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_social_oauth_states_provider_status
    ON social_oauth_states(provider, status);

CREATE TABLE IF NOT EXISTS social_oauth_pages (
    id SERIAL PRIMARY KEY,
    oauth_state_id INTEGER NOT NULL REFERENCES social_oauth_states(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_account_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    category TEXT,
    encrypted_access_token TEXT NOT NULL,
    scopes TEXT,
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (oauth_state_id, provider, external_account_id)
);
