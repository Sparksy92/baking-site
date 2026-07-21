-- 064_seed_missing_platform_configs.sql
-- YouTube, Pinterest, and Threads were missing from social_platform_configs.
-- They have full OAuth + publish implementations but never appeared in the
-- Admin → Social → Platforms UI because no config row existed.

INSERT INTO social_platform_configs
    (platform, display_name, enabled, max_hashtags, max_caption_chars, hashtag_mode, setup_status, setup_notes)
VALUES
    (
        'youtube',
        'YouTube',
        FALSE,
        5,
        5000,
        'auto',
        'not_configured',
        'Requires YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI in .env. Set up OAuth credentials in Google Cloud Console → YouTube Data API v3.'
    ),
    (
        'pinterest',
        'Pinterest',
        FALSE,
        20,
        500,
        'auto',
        'not_configured',
        'Requires PINTEREST_CLIENT_ID, PINTEREST_CLIENT_SECRET, PINTEREST_REDIRECT_URI in .env. Register your app at developers.pinterest.com.'
    ),
    (
        'threads',
        'Threads',
        FALSE,
        5,
        500,
        'auto',
        'not_configured',
        'Reuses META_APP_ID and META_APP_SECRET. Add META_THREADS_REDIRECT_URI to .env and register it in the Meta developer portal under the Threads product.'
    )
ON CONFLICT (platform) DO NOTHING;
