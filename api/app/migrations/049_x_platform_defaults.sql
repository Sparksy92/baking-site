-- 048_x_platform_defaults.sql
-- Ensure the reusable X/Twitter provider uses the current provider key and MVP defaults.

INSERT INTO social_platform_configs
    (platform, display_name, enabled, max_hashtags, max_caption_chars, setup_status, setup_notes)
VALUES
    (
        'x',
        'X (Twitter)',
        FALSE,
        2,
        280,
        'not_configured',
        'X API write access requires an approved developer app with write permissions and paid/usage-enabled API access.'
    )
ON CONFLICT (platform) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    max_hashtags = 2,
    max_caption_chars = 280,
    setup_notes = EXCLUDED.setup_notes,
    updated_at = CURRENT_TIMESTAMP;

UPDATE social_platform_configs
SET setup_notes = 'X API write access requires an approved developer app with write permissions and paid/usage-enabled API access.'
WHERE platform IN ('x', 'twitter');
