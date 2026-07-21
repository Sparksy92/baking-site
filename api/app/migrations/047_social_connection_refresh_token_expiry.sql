-- 046_social_connection_refresh_token_expiry.sql
-- Track OAuth refresh-token expiry separately from access-token expiry.

ALTER TABLE social_connections
    ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMP WITH TIME ZONE;
