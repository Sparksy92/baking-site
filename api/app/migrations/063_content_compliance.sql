-- 062_content_compliance.sql
-- Content compliance checking tables
-- Tracks compliance checks on social posts

CREATE TABLE content_compliance_checks (
    id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES social_posts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('clean', 'warning', 'violation')),
    severity TEXT NOT NULL CHECK (severity IN ('clean', 'info', 'warning', 'critical')),
    issues_json TEXT NOT NULL DEFAULT '[]',  -- JSON array of ComplianceIssue objects
    ai_analysis TEXT,
    policy_version_id INTEGER REFERENCES policy_versions(id),
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    can_auto_fix BOOLEAN DEFAULT FALSE,
    auto_fixed BOOLEAN DEFAULT FALSE,
    fixed_content TEXT,  -- content after auto-fix
    fix_attempts INTEGER DEFAULT 0
);

CREATE INDEX idx_compliance_checks_content ON content_compliance_checks(content_id);
CREATE INDEX idx_compliance_checks_status ON content_compliance_checks(status);
CREATE INDEX idx_compliance_checks_platform ON content_compliance_checks(platform, checked_at);

-- Add compliance status to social_posts for quick lookup
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS compliance_status TEXT 
    CHECK (compliance_status IN ('clean', 'warning', 'violation', 'unchecked'))
    DEFAULT 'unchecked';

ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS compliance_checked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS compliance_issues_count INTEGER DEFAULT 0;

-- Index for filtering by compliance status
CREATE INDEX idx_social_posts_compliance ON social_posts(compliance_status) 
    WHERE compliance_status IN ('warning', 'violation');

-- Add media compliance columns (for image/video checking)
ALTER TABLE content_compliance_checks ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE content_compliance_checks ADD COLUMN IF NOT EXISTS media_type TEXT 
    CHECK (media_type IN ('image', 'video', 'text')) DEFAULT 'text';
ALTER TABLE content_compliance_checks ADD COLUMN IF NOT EXISTS safety_scores_json TEXT DEFAULT '{}';

-- Create compliance scorecard view
CREATE OR REPLACE VIEW compliance_scorecard AS
SELECT 
    platform,
    date(checked_at) as check_date,
    COUNT(*) as total_checks,
    SUM(CASE WHEN status = 'clean' THEN 1 ELSE 0 END) as clean_count,
    SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_count,
    SUM(CASE WHEN status = 'violation' THEN 1 ELSE 0 END) as violation_count,
    AVG(CASE WHEN status = 'clean' THEN 1.0 ELSE 0.0 END) as compliance_rate
FROM content_compliance_checks
GROUP BY platform, date(checked_at)
ORDER BY check_date DESC;
