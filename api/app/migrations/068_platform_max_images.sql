-- Migration 067: add max_images_per_post to social_platform_configs
--
-- Controls how many images are attached per draft for each platform.
-- Multi-image platforms get the real API limit; single-image platforms get 1.
-- Editable in Social → Platforms so you can override if the API changes.

ALTER TABLE social_platform_configs
    ADD COLUMN IF NOT EXISTS max_images_per_post INTEGER DEFAULT 1;

-- Set accurate defaults per platform
UPDATE social_platform_configs SET max_images_per_post = 10 WHERE platform = 'facebook';
UPDATE social_platform_configs SET max_images_per_post = 10 WHERE platform = 'instagram';
UPDATE social_platform_configs SET max_images_per_post = 20 WHERE platform = 'linkedin';
UPDATE social_platform_configs SET max_images_per_post = 10 WHERE platform = 'threads';
UPDATE social_platform_configs SET max_images_per_post = 35 WHERE platform = 'tiktok';
UPDATE social_platform_configs SET max_images_per_post = 4  WHERE platform = 'x';
UPDATE social_platform_configs SET max_images_per_post = 1  WHERE platform = 'youtube';
UPDATE social_platform_configs SET max_images_per_post = 1  WHERE platform = 'pinterest';
