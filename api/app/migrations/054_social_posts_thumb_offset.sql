-- Sprint 11: Instagram Reel thumbnail offset (ms into the video)
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS thumb_offset_ms INTEGER;
