-- Migration 002: SEO fields across all content types + redirects table
-- Adds per-entity SEO control: noindex, canonical override, OG image override,
-- meta_title/description on collections & categories, intro copy, and a
-- redirect table for 301 management.

-- ── Products ─────────────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS noindex BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS canonical_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS og_image_url TEXT;

-- ── Collections ──────────────────────────────────────────────────────────────
ALTER TABLE collections ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS intro_copy TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS noindex BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Categories ───────────────────────────────────────────────────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS intro_copy TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS noindex BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Pages / Blog Posts ───────────────────────────────────────────────────────
ALTER TABLE pages ADD COLUMN IF NOT EXISTS noindex BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS canonical_url TEXT;

-- ── Redirects ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS redirects (
    id SERIAL PRIMARY KEY,
    from_path TEXT NOT NULL UNIQUE,
    to_path TEXT NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 301,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_redirects_from_active ON redirects(from_path) WHERE is_active = TRUE;
