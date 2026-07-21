-- Sprint 13: Add portal_token to influencer_collaborations for public submission URL
ALTER TABLE influencer_collaborations ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE;
ALTER TABLE influencer_submissions ADD COLUMN IF NOT EXISTS submitted_by_name TEXT;
ALTER TABLE influencer_submissions ADD COLUMN IF NOT EXISTS submitted_by_email TEXT;
