-- 032_social_engagement.sql
-- Stores incoming engagement events from Meta webhooks (comments, reactions,
-- mentions, story insights) so they can be surfaced in the admin and used
-- by the AI reply feature in Sprint 5.

CREATE TABLE IF NOT EXISTS social_engagement_events (
    id                  SERIAL PRIMARY KEY,
    platform            TEXT NOT NULL,                -- 'facebook' | 'instagram'
    platform_post_id    TEXT,                         -- the platform's post ID this event belongs to
    event_type          TEXT NOT NULL DEFAULT '',     -- 'comment' | 'reaction' | 'share' | 'mention' | 'story_insights'
    event_verb          TEXT NOT NULL DEFAULT '',     -- 'add' | 'edited' | 'remove' | 'like' etc.
    actor_name          TEXT NOT NULL DEFAULT '',     -- display name of the person who took the action
    actor_id            TEXT,                         -- platform user/page ID
    message             TEXT,                         -- comment text or caption if available
    raw_payload         TEXT,                         -- full JSON from Meta for debugging
    replied_at          TIMESTAMP WITH TIME ZONE,     -- set when admin sends a reply
    reply_content       TEXT,                         -- the reply that was sent
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_social_engagement_platform_post
    ON social_engagement_events (platform, platform_post_id);

CREATE INDEX IF NOT EXISTS idx_social_engagement_created
    ON social_engagement_events (created_at DESC);
