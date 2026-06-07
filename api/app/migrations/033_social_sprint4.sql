-- 033_social_sprint4.sql
-- Sprint 4 additions: video support, scheduling, media library

-- Add video_url to social_posts (for phone-uploaded or AI-generated video)
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add product_id to social_posts (for Product → Social direct path)
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;

-- scheduled_at already exists from migration 031; ensure index exists for scheduler query
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled
    ON social_posts (scheduled_at)
    WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

-- Media library: shared image/video assets reusable across posts
CREATE TABLE IF NOT EXISTS media_library (
    id              SERIAL PRIMARY KEY,
    filename        TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    mime_type       TEXT NOT NULL DEFAULT 'image/jpeg',
    size_bytes      INTEGER,
    url             TEXT NOT NULL,          -- served path e.g. /media/library/abc123.jpg
    alt_text        TEXT NOT NULL DEFAULT '',
    tags            TEXT NOT NULL DEFAULT '',  -- comma-separated for filtering
    uploaded_by     TEXT NOT NULL DEFAULT 'admin',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_library_created
    ON media_library (created_at DESC);
