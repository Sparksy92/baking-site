-- Migration 059: Add AI disclosure + approval workflow to pages table
-- Adds: ai_generated flag, ai_disclosure flag, approved status support

ALTER TABLE pages
    ADD COLUMN IF NOT EXISTS ai_generated  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ai_disclosure BOOLEAN NOT NULL DEFAULT FALSE;

-- Widen status check to allow 'approved' between draft and published
-- PostgreSQL: drop existing constraint (if any) and re-add
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'pages' AND constraint_type = 'CHECK'
    ) THEN
        ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_status_check;
    END IF;
END $$;

ALTER TABLE pages
    ADD CONSTRAINT pages_status_check
    CHECK (status IN ('draft', 'approved', 'published', 'archived'));

-- Backfill: existing 'published' rows stay published, everything else stays draft
-- No data changes needed — existing values are already valid under the new constraint
