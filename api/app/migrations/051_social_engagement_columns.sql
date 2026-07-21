-- Migration 050: add per-post engagement metric columns to social_posts
-- These are populated by the background engagement_service sync job.

ALTER TABLE social_posts
    ADD COLUMN IF NOT EXISTS impressions      INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS likes            INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS comments_count   INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shares           INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS clicks           INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMP WITH TIME ZONE;
