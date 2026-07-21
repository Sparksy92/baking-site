-- Migration 065: add strategy_content_type to social_posts
--
-- Separates the Gary Vee content mix category (educational / community /
-- promotional / entertaining etc.) from the existing content_type column
-- which tracks the media format (feed / reel / story).
--
-- strategy_content_type is set automatically at generation time by
-- pick_content_type_for_platform() — never entered manually by the user.

ALTER TABLE social_posts
    ADD COLUMN IF NOT EXISTS strategy_content_type TEXT DEFAULT NULL;

-- Index for fast mix-health queries (GROUP BY strategy_content_type per platform)
CREATE INDEX IF NOT EXISTS idx_social_posts_strategy_content_type
    ON social_posts (platform, strategy_content_type)
    WHERE strategy_content_type IS NOT NULL;
