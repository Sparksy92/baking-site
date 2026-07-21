-- 047_social_oauth_state_metadata.sql
-- Store provider-specific one-time OAuth state data such as X OAuth2 PKCE verifier.

ALTER TABLE social_oauth_states
    ADD COLUMN IF NOT EXISTS metadata TEXT;
