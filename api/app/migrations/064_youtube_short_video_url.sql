-- Migration 063: Add short_video_url column to social_posts for YouTube Shorts
-- YouTube Shorts require a separate vertical (9:16) video ≤60s.
-- Keeping it separate from video_url (long-form) avoids ambiguity on publish.

ALTER TABLE social_posts
    ADD COLUMN IF NOT EXISTS short_video_url TEXT;

COMMENT ON COLUMN social_posts.short_video_url IS
    'YouTube Shorts video URL (vertical 9:16, ≤60s). '
    'Only used when platform=youtube and content_type=short. '
    'Takes precedence over video_url for Short publishing.';
