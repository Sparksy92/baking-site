-- Migration 057: Unified Media Library
-- Replaces the two separate tables (media_library from social/media/upload,
-- social_media_library from social/media-library/upload) with a single table.
-- Old tables are left intact so existing URLs continue to work during transition.

CREATE TABLE IF NOT EXISTS media_library_v2 (
    id              SERIAL PRIMARY KEY,
    filename        TEXT    NOT NULL UNIQUE,          -- AI-renamed SEO slug + uuid8 suffix + ext
    original_name   TEXT    NOT NULL,                 -- original filename as uploaded
    file_type       TEXT    NOT NULL DEFAULT 'image', -- 'image' | 'video'
    mime_type       TEXT    NOT NULL,
    size_bytes      INTEGER NOT NULL DEFAULT 0,
    url             TEXT    NOT NULL,                 -- /media/{filename}
    alt_text        TEXT    NOT NULL DEFAULT '',      -- AI-generated, editable by admin
    ai_generated_alt BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE if alt_text came from vision AI
    tags            TEXT    NOT NULL DEFAULT '[]',    -- JSON array of tag strings
    uploaded_by     TEXT    NOT NULL DEFAULT 'admin',
    used_count      INTEGER NOT NULL DEFAULT 0,       -- incremented when assigned to content
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_library_v2_file_type ON media_library_v2 (file_type);
CREATE INDEX IF NOT EXISTS idx_media_library_v2_created_at ON media_library_v2 (created_at DESC);
