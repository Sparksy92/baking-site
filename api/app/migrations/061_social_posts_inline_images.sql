-- 060_social_posts_inline_images.sql
-- Add column to store inline images extracted from blog post HTML content
-- These are additional images beyond the featured_image_url

ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS additional_image_urls TEXT;  -- JSON array of URLs from content_html body

-- Update comment for documentation
COMMENT ON COLUMN social_posts.additional_image_urls IS 'JSON array of image URLs extracted from blog post HTML content (inline images)';
