-- From 030_blog_social_sync.sql
-- Add external_id to pages to track synced social media posts and prevent duplicates

ALTER TABLE pages ADD COLUMN external_id TEXT UNIQUE;
