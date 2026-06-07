-- 039_sprint8_sprint9_final.sql
-- Sprint 5.5: Meta reply publishing
-- Sprint 8: Influencer Management, Brand Safety, Auto-moderation
-- Sprint 9: Content Prediction, Weekly Reports, Hashtag Analytics

-- Sprint 5.5: Store the external comment_id for reply publishing
ALTER TABLE social_engagement_events ADD COLUMN IF NOT EXISTS external_comment_id TEXT;
ALTER TABLE social_engagement_events ADD COLUMN IF NOT EXISTS external_post_id TEXT;

-- Sprint 8: Influencer Management
CREATE TABLE IF NOT EXISTS influencers (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    platform        TEXT NOT NULL,              -- 'instagram', 'tiktok', 'youtube', etc.
    handle          TEXT NOT NULL,              -- @username
    profile_url     TEXT,
    follower_count  INTEGER,
    engagement_rate REAL,                       -- avg likes+comments/followers
    niche           TEXT,                       -- 'fashion', 'beauty', 'lifestyle'
    location        TEXT,
    email           TEXT,
    phone           TEXT,
    notes           TEXT,
    portfolio_url   TEXT,                       -- link to past work
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS influencer_collaborations (
    id              SERIAL PRIMARY KEY,
    influencer_id   INTEGER REFERENCES influencers(id),
    campaign_name   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'proposed',  -- 'proposed' | 'contract_sent' | 'active' | 'completed' | 'cancelled'
    deliverables    TEXT,                       -- JSON: {"posts": 2, "stories": 3, "reels": 1}
    compensation_cents INTEGER,               -- total pay
    product_value_cents INTEGER,              -- gifted product value
    start_date      DATE,
    end_date        DATE,
    content_requirements TEXT,                  -- brief
    approval_required BOOLEAN DEFAULT TRUE,     -- does admin approve before posting?
    tracking_code   TEXT,                     -- unique UTM code for this collab
    -- Results
    posts_delivered INTEGER DEFAULT 0,
    reach_total     INTEGER DEFAULT 0,
    engagement_total INTEGER DEFAULT 0,
    revenue_attributed_cents INTEGER DEFAULT 0,
    roi_percent     INTEGER,                    -- calculated (revenue - cost) / cost
    created_by      TEXT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Content submitted by influencers for approval
CREATE TABLE IF NOT EXISTS influencer_submissions (
    id              SERIAL PRIMARY KEY,
    collaboration_id INTEGER REFERENCES influencer_collaborations(id),
    content_type    TEXT NOT NULL,              -- 'post' | 'story' | 'reel'
    caption         TEXT,
    media_urls      TEXT,                       -- JSON array of image/video URLs
    submitted_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected' | 'revision_requested'
    reviewed_by     TEXT,
    reviewed_at     TIMESTAMP WITH TIME ZONE,
    feedback        TEXT,
    platform_post_id TEXT,                     -- filled when they publish
    performance_metrics TEXT                   -- JSON of reach/engagement
);

-- Sprint 8: Brand Safety Scanning
CREATE TABLE IF NOT EXISTS brand_safety_scans (
    id              SERIAL PRIMARY KEY,
    content_type    TEXT NOT NULL,              -- 'social_post' | 'blog_post' | 'influencer_submission'
    content_id      INTEGER NOT NULL,
    content_text    TEXT,
    -- AI scan results
    is_safe         BOOLEAN,
    risk_level      TEXT,                       -- 'low' | 'medium' | 'high' | 'critical'
    risk_categories TEXT,                       -- JSON: ["hate_speech", "misinformation", "controversial"]
    flagged_keywords TEXT,                      -- what triggered flags
    ai_explanation  TEXT,                       -- why it was flagged
    -- Human override
    reviewed_by     TEXT,
    override_safe   BOOLEAN,                    -- human overrode AI
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sprint 8: Auto-comment moderation rules
CREATE TABLE IF NOT EXISTS moderation_rules (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    rule_type       TEXT NOT NULL,              -- 'keyword' | 'sentiment' | 'spam' | 'user_block'
    condition       TEXT NOT NULL,              -- 'contains' | 'regex' | 'sentiment_below' | 'user_in_list'
    pattern         TEXT NOT NULL,              -- keyword, regex, or threshold
    action          TEXT NOT NULL,              -- 'hide' | 'delete' | 'flag_for_review' | 'auto_reply'
    auto_reply_text TEXT,                       -- if action is auto_reply
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    match_count     INTEGER DEFAULT 0,          -- how many times triggered
    created_by      TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Moderation actions taken
CREATE TABLE IF NOT EXISTS moderation_actions (
    id              SERIAL PRIMARY KEY,
    rule_id         INTEGER REFERENCES moderation_rules(id),
    engagement_event_id INTEGER REFERENCES social_engagement_events(id),
    action_taken    TEXT NOT NULL,              -- what we did
    applied_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sprint 9: Content Performance Predictions
CREATE TABLE IF NOT EXISTS content_predictions (
    id              SERIAL PRIMARY KEY,
    content_type    TEXT NOT NULL,              -- 'social_post' | 'influencer_submission'
    content_id      INTEGER NOT NULL,
    -- Predictions (before publish)
    predicted_reach INTEGER,
    predicted_engagement INTEGER,
    predicted_ctr   REAL,
    confidence_score REAL,                      -- 0.0-1.0
    prediction_model TEXT,                     -- which model version
    -- Actuals (filled after publish)
    actual_reach    INTEGER,
    actual_engagement INTEGER,
    actual_ctr      REAL,
    accuracy_delta  REAL,                       -- prediction vs actual
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP WITH TIME ZONE   -- when actuals were filled
);

-- Sprint 9: Weekly Report Subscriptions
CREATE TABLE IF NOT EXISTS report_subscriptions (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL,
    report_type     TEXT NOT NULL DEFAULT 'weekly_social',  -- 'weekly_social' | 'monthly_analytics' | 'crisis_alerts'
    day_of_week     INTEGER,                    -- 0=Sunday for weekly
    day_of_month    INTEGER,                    -- 1-31 for monthly
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_sent_at    TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sprint 9: Hashtag Performance
CREATE TABLE IF NOT EXISTS hashtag_performance (
    id              SERIAL PRIMARY KEY,
    hashtag         TEXT NOT NULL,
    platform        TEXT NOT NULL,
    -- Aggregated stats
    posts_count     INTEGER DEFAULT 0,
    avg_reach       INTEGER DEFAULT 0,
    avg_engagement  INTEGER DEFAULT 0,
    avg_ctr         REAL DEFAULT 0,
    best_performing_post_id INTEGER,
    trending_score  REAL DEFAULT 0,           -- velocity of growth
    last_calculated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(hashtag, platform)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_influencer_collab_status ON influencer_collaborations (status);
CREATE INDEX IF NOT EXISTS idx_influencer_submissions_status ON influencer_submissions (status);
CREATE INDEX IF NOT EXISTS idx_brand_safety_content ON brand_safety_scans (content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_moderation_rules_active ON moderation_rules (is_active, rule_type);
CREATE INDEX IF NOT EXISTS idx_content_predictions_content ON content_predictions (content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_hashtag_perf_hashtag ON hashtag_performance (hashtag, platform);
