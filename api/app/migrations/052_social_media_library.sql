-- Sprint 9: Social Media Library
-- Stores uploaded images/videos for reuse across social posts

CREATE TABLE IF NOT EXISTS social_media_library (
    id              SERIAL PRIMARY KEY,
    filename        TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    file_url        TEXT NOT NULL,
    file_type       TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
    mime_type       TEXT,
    file_size_bytes INTEGER,
    width           INTEGER,
    height          INTEGER,
    duration_secs   REAL,
    alt_text        TEXT,
    tags            TEXT DEFAULT '[]',
    uploaded_by     TEXT DEFAULT 'admin',
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_library_file_type ON social_media_library (file_type);
CREATE INDEX IF NOT EXISTS idx_media_library_created_at ON social_media_library (created_at DESC);
