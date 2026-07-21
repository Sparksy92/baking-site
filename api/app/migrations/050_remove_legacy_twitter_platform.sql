-- 049_remove_legacy_twitter_platform.sql
-- The reusable X/Twitter provider uses provider key `x`.
-- Older migrations seeded a legacy `twitter` config row, which creates a duplicate card in Admin.

UPDATE social_platform_configs AS x
SET display_name = 'X (Twitter)',
    enabled = x.enabled OR legacy.enabled,
    prompt_template = COALESCE(NULLIF(x.prompt_template, ''), legacy.prompt_template),
    hashtag_mode = COALESCE(x.hashtag_mode, legacy.hashtag_mode),
    brand_hashtag = COALESCE(NULLIF(x.brand_hashtag, ''), legacy.brand_hashtag),
    banned_hashtags = COALESCE(NULLIF(x.banned_hashtags, ''), legacy.banned_hashtags),
    max_hashtags = COALESCE(x.max_hashtags, legacy.max_hashtags, 2),
    max_caption_chars = COALESCE(x.max_caption_chars, legacy.max_caption_chars, 280),
    auto_publish = x.auto_publish OR legacy.auto_publish,
    account_id = COALESCE(NULLIF(x.account_id, ''), legacy.account_id),
    setup_status = CASE
        WHEN x.setup_status IS NULL OR x.setup_status = 'not_configured'
        THEN legacy.setup_status
        ELSE x.setup_status
    END,
    setup_notes = COALESCE(NULLIF(x.setup_notes, ''), legacy.setup_notes),
    updated_at = CURRENT_TIMESTAMP
FROM social_platform_configs AS legacy
WHERE x.platform = 'x'
  AND legacy.platform = 'twitter';

DELETE FROM social_platform_configs
WHERE platform = 'twitter';

UPDATE social_platform_configs
SET display_name = 'X (Twitter)'
WHERE platform = 'x';
