-- 045_social_connection_metadata.sql
-- Ensure provider metadata exists for stacked/upgraded social OAuth branches.

ALTER TABLE social_connections
    ADD COLUMN IF NOT EXISTS metadata TEXT;

ALTER TABLE social_oauth_pages
    ADD COLUMN IF NOT EXISTS metadata TEXT;
