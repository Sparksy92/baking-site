-- 031_social_platform.sql
-- Social media platform management: brand persona, per-platform config, outbound post outbox

-- Brand persona: defines the AI voice injected into every content generation call
CREATE TABLE IF NOT EXISTS brand_persona (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL DEFAULT 'Default',
    voice           TEXT NOT NULL DEFAULT '',
    audience        TEXT NOT NULL DEFAULT '',
    values_text     TEXT NOT NULL DEFAULT '',
    words_to_use    TEXT NOT NULL DEFAULT '',
    words_to_avoid  TEXT NOT NULL DEFAULT '',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Per-platform configuration: enabled toggle, custom prompt, credentials, hashtag bank
CREATE TABLE IF NOT EXISTS social_platform_configs (
    id                  SERIAL PRIMARY KEY,
    platform            TEXT NOT NULL UNIQUE,   -- 'facebook' | 'instagram' | 'x' | 'linkedin' | 'tiktok' | 'youtube'
    enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    display_name        TEXT NOT NULL DEFAULT '',
    prompt_template     TEXT NOT NULL DEFAULT '',
    hashtag_bank        TEXT NOT NULL DEFAULT '',   -- newline-separated hashtags
    auto_publish        BOOLEAN NOT NULL DEFAULT FALSE,
    -- OAuth / API credentials (stored encrypted at rest by DB, never returned to frontend)
    access_token        TEXT,
    refresh_token       TEXT,
    token_expires_at    TIMESTAMP WITH TIME ZONE,
    account_id          TEXT,                      -- platform-specific page/account ID
    -- Setup / approval state for platforms requiring app review
    setup_status        TEXT NOT NULL DEFAULT 'not_configured',  -- 'not_configured' | 'pending_review' | 'active' | 'error'
    setup_notes         TEXT,                      -- visible in admin — e.g. "Submit TikTok app for review"
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Outbound social post outbox: one row per platform per source blog post
CREATE TABLE IF NOT EXISTS social_posts (
    id                  SERIAL PRIMARY KEY,
    page_id             INTEGER REFERENCES pages(id) ON DELETE CASCADE,  -- source blog post
    platform            TEXT NOT NULL,
    content             TEXT NOT NULL,             -- platform-native generated content
    image_url           TEXT,                      -- image to attach (from blog featured_image_url)
    hashtags            TEXT,                      -- resolved hashtags for this post
    status              TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'approved' | 'scheduled' | 'published' | 'failed'
    scheduled_at        TIMESTAMP WITH TIME ZONE,
    published_at        TIMESTAMP WITH TIME ZONE,
    platform_post_id    TEXT,                      -- ID returned by platform API after publish
    error_message       TEXT,                      -- last error if status = 'failed'
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed default platform configs (disabled by default, with setup guidance)
INSERT INTO social_platform_configs (platform, display_name, setup_status, setup_notes)
VALUES
    ('facebook',  'Facebook',  'not_configured', 'Add META_PAGE_ACCESS_TOKEN and META_FACEBOOK_PAGE_ID to your environment variables.'),
    ('instagram', 'Instagram', 'not_configured', 'Add META_PAGE_ACCESS_TOKEN and META_INSTAGRAM_ACCOUNT_ID to your environment variables.'),
    ('x',         'X / Twitter', 'not_configured', 'X API requires a paid Basic tier ($100/mo). Register at developer.twitter.com, then add X_API_KEY and X_API_SECRET.'),
    ('linkedin',  'LinkedIn',  'not_configured', 'Register a free app at developer.linkedin.com. Requires a LinkedIn Company Page. App review takes 1–2 weeks.'),
    ('tiktok',    'TikTok',    'not_configured', 'Register at developers.tiktok.com and request Content Posting API access. App review takes 1–4 weeks. Submit early.'),
    ('youtube',   'YouTube',   'not_configured', 'YouTube only supports video content. Text posts are not supported. Phase 3 — requires AI video generation integration.')
ON CONFLICT (platform) DO NOTHING;
