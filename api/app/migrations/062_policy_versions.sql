-- 061_policy_versions.sql
-- Policy update monitoring system for social platform compliance
-- Tracks policy changes, requires admin approval, maintains audit history

-- Policy sources configuration (what to monitor)
CREATE TABLE policy_sources (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL,              -- facebook, instagram, x, linkedin, tiktok, youtube, pinterest, threads
    policy_type TEXT NOT NULL,           -- community_guidelines, ad_policy, commerce_policy, terms_of_service
    policy_name TEXT NOT NULL,           -- display name for UI
    source_url TEXT NOT NULL,            -- URL to fetch from
    is_active BOOLEAN DEFAULT TRUE,      -- enable/disable monitoring
    fetch_cron TEXT DEFAULT '0 9 * * 1',   -- weekly on Monday 9am
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, policy_type)
);

-- Insert default policy sources for supported platforms
-- URL notes:
-- Facebook: communitystandards/ returns HTTP 400; transparency.fb.com serves same content without bot blocking.
-- Instagram ad policy: served from Meta's transparency center (same as Facebook ads).
-- X/Twitter: Cloudflare blocks all automated fetches (403). is_active=FALSE — must use manual upload via the Upload button.
-- LinkedIn: /help/linkedin/answer/138843 returns 404; correct URL is /legal/professional-community-policies.
-- TikTok community guidelines page is a JS shell; advertiser policies URL is server-rendered.
INSERT INTO policy_sources (platform, policy_type, policy_name, source_url, is_active) VALUES
    ('facebook', 'community_guidelines', 'Facebook Community Guidelines', 'https://transparency.fb.com/policies/community-standards/', TRUE),
    ('facebook', 'ad_policy', 'Facebook Advertising Policies', 'https://transparency.fb.com/policies/ad-standards/', TRUE),
    ('instagram', 'community_guidelines', 'Instagram Community Guidelines', 'https://help.instagram.com/477434105621946', TRUE),
    ('instagram', 'ad_policy', 'Instagram Advertising Policies', 'https://transparency.fb.com/policies/ad-standards/', TRUE),
    ('x', 'community_guidelines', 'X Rules and Policies', 'https://help.x.com/en/rules-and-policies/x-rules', FALSE),
    ('linkedin', 'community_guidelines', 'LinkedIn Professional Community Policies', 'https://www.linkedin.com/legal/professional-community-policies', TRUE),
    ('tiktok', 'community_guidelines', 'TikTok Advertising Policies', 'https://ads.tiktok.com/help/article/tiktok-advertising-policies-ad-creatives-landing-page?lang=en', TRUE),
    ('youtube', 'community_guidelines', 'YouTube Community Guidelines', 'https://www.youtube.com/howyoutubeworks/policies/community-guidelines/', TRUE),
    ('pinterest', 'community_guidelines', 'Pinterest Community Guidelines', 'https://policy.pinterest.com/en/community-guidelines', TRUE),
    ('threads', 'community_guidelines', 'Threads Community Guidelines', 'https://help.instagram.com/769437079840854', TRUE)
ON CONFLICT (platform, policy_type) DO NOTHING;

-- Policy versions (tracked changes)
CREATE TABLE policy_versions (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES policy_sources(id) ON DELETE CASCADE,
    version TEXT NOT NULL,               -- date-based: 2024-06-15-r1, 2024-06-15-r2 for multiple changes same day
    content_text TEXT NOT NULL,          -- plain text, HTML stripped
    content_html TEXT,                   -- original HTML if available
    content_hash TEXT NOT NULL,          -- sha256 of content_text
    previous_hash TEXT,                  -- hash of previous version for diff
    status TEXT DEFAULT 'pending_review' 
        CHECK (status IN ('active', 'pending_review', 'archived', 'rejected', 'failed_fetch')),
    
    -- Severity classification (auto-detected)
    severity TEXT DEFAULT 'info'
        CHECK (severity IN ('critical', 'warning', 'info')),
    severity_reason TEXT,                -- AI or rule-based explanation
    
    -- Change tracking
    change_summary TEXT,                 -- AI or manual summary of changes
    added_keywords TEXT[],               -- keywords that appeared (for search)
    removed_keywords TEXT[],             -- keywords that disappeared
    
    -- Manual upload fallback
    is_manual_upload BOOLEAN DEFAULT FALSE,
    uploaded_by TEXT,                    -- admin email if manually uploaded
    
    -- Fetch tracking
    fetched_at TIMESTAMP WITH TIME ZONE,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    fetch_attempts INTEGER DEFAULT 0,
    fetch_error TEXT,                    -- last error message if failed
    
    -- Audit / approval
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_by TEXT,                    -- admin email who approved
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_notes TEXT,                 -- admin notes on approval
    rejected_by TEXT,                    -- admin email who rejected
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Retention (2 years after archival)
    archived_at TIMESTAMP WITH TIME ZONE,
    purge_after TIMESTAMP WITH TIME ZONE
);

-- Index for quick lookups
CREATE INDEX idx_policy_versions_source_status ON policy_versions(source_id, status);
CREATE INDEX idx_policy_versions_hash ON policy_versions(content_hash);
CREATE INDEX idx_policy_versions_pending ON policy_versions(status) WHERE status = 'pending_review';
CREATE INDEX idx_policy_versions_active ON policy_versions(source_id, status) WHERE status = 'active';

-- Trigger to auto-set purge date (2 years after archival)
CREATE OR REPLACE FUNCTION set_policy_purge_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'archived' AND (OLD.status IS NULL OR OLD.status != 'archived') THEN
        NEW.archived_at = CURRENT_TIMESTAMP;
        NEW.purge_after = CURRENT_TIMESTAMP + INTERVAL '2 years';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_policy_purge_date
    BEFORE UPDATE ON policy_versions
    FOR EACH ROW
    EXECUTE FUNCTION set_policy_purge_date();

-- Notifications for in-app alerts
CREATE TABLE policy_notifications (
    id SERIAL PRIMARY KEY,
    policy_version_id INTEGER REFERENCES policy_versions(id) ON DELETE CASCADE,
    admin_email TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_policy_notifications_unread ON policy_notifications(admin_email, is_read) WHERE is_read = FALSE;

-- Link social posts to policy versions (for compliance audit trail)
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS policy_version_id INTEGER REFERENCES policy_versions(id);

-- Audit log for policy actions
CREATE TABLE policy_audit_log (
    id SERIAL PRIMARY KEY,
    policy_version_id INTEGER REFERENCES policy_versions(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created', 'approved', 'rejected', 'rollback', 'activated', 'archived', 'manual_upload')),
    performed_by TEXT NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    previous_status TEXT,
    new_status TEXT
);

CREATE INDEX idx_policy_audit_version ON policy_audit_log(policy_version_id, performed_at);
