-- Add keywords column to pages table for blog post SEO and related-post matching
ALTER TABLE pages ADD COLUMN IF NOT EXISTS keywords TEXT;
