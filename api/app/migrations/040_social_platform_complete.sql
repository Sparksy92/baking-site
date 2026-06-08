-- 040_social_platform_complete.sql
-- Clean combined migration for all social platform features
-- Replaces migrations 030-039 with proper dependency ordering

-- Drop existing social tables in reverse dependency order (for clean reset)
DROP TABLE IF EXISTS moderation_actions CASCADE;
DROP TABLE IF EXISTS moderation_rules CASCADE;
DROP TABLE IF EXISTS brand_safety_scans CASCADE;
DROP TABLE IF EXISTS influencer_submissions CASCADE;
DROP TABLE IF EXISTS influencer_collaborations CASCADE;
DROP TABLE IF EXISTS influencers CASCADE;
DROP TABLE IF EXISTS content_predictions CASCADE;
DROP TABLE IF EXISTS hashtag_performance CASCADE;
DROP TABLE IF EXISTS report_subscriptions CASCADE;
DROP TABLE IF EXISTS ab_test_variants CASCADE;
DROP TABLE IF EXISTS ab_tests CASCADE;
DROP TABLE IF EXISTS crisis_alerts CASCADE;
DROP TABLE IF EXISTS sentiment_scores CASCADE;
DROP TABLE IF EXISTS hashtag_suggestions CASCADE;
DROP TABLE IF EXISTS admin_audit_log CASCADE;
DROP TABLE IF EXISTS agent_audit_log CASCADE;
DROP TABLE IF EXISTS agent_content_submissions CASCADE;
DROP TABLE IF EXISTS agent_api_keys CASCADE;
DROP TABLE IF EXISTS social_agent_keys CASCADE;
DROP TABLE IF EXISTS content_templates CASCADE;
DROP TABLE IF EXISTS ai_model_configs CASCADE;
DROP TABLE IF EXISTS media_library CASCADE;
DROP TABLE IF EXISTS social_engagement_metrics CASCADE;
DROP TABLE IF EXISTS social_engagement_events CASCADE;
DROP TABLE IF EXISTS social_posts CASCADE;
DROP TABLE IF EXISTS brand_persona CASCADE;
DROP TABLE IF EXISTS social_platform_configs CASCADE;

-- =====================================================
-- SPRINT 1-3: CORE SOCIAL PLATFORM
-- =====================================================

-- Brand persona (no dependencies)
CREATE TABLE brand_persona (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Default',
    voice TEXT,
    audience TEXT,
    values_text TEXT,
    words_to_use TEXT,
    words_to_avoid TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platform configurations (no dependencies)
CREATE TABLE social_platform_configs (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL UNIQUE,
    display_name TEXT,
    page_id TEXT,
    account_id TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    webhook_verify_token TEXT,
    prompt_template TEXT,
    hashtag_mode TEXT DEFAULT 'auto',           -- 'auto' | 'manual' | 'none'
    brand_hashtag TEXT,                          -- single always-appended brand tag e.g. '#NativeStreet'
    banned_hashtags TEXT,                        -- newline-separated list of tags to never use
    max_hashtags INTEGER DEFAULT 5,              -- platform-specific limit
    max_caption_chars INTEGER DEFAULT 2200,      -- platform-specific char limit
    auto_publish BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    setup_status TEXT,
    setup_notes TEXT,
    settings TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Social posts (no dependencies)
CREATE TABLE social_posts (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    content_type TEXT DEFAULT 'feed',
    content TEXT NOT NULL,
    image_url TEXT,
    video_url TEXT,
    link_url TEXT,
    page_id INTEGER,
    product_id INTEGER,
    external_post_id TEXT,
    platform_post_id TEXT,
    error_message TEXT,
    status TEXT DEFAULT 'draft',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    engagement_score REAL,
    reach_count INTEGER,
    revenue_attributed_cents INTEGER DEFAULT 0,
    orders_attributed INTEGER DEFAULT 0,
    hashtags TEXT,                                -- JSON array of hashtags for this specific post
    ab_test_variant_id INTEGER,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Engagement events (depends on social_posts)
CREATE TABLE social_engagement_events (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES social_posts(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    platform TEXT,
    platform_user_id TEXT,
    platform_user_name TEXT,
    platform_post_id TEXT,
    actor_name TEXT,
    message TEXT,
    raw_payload TEXT,
    content TEXT,
    parent_event_id INTEGER,
    is_replied BOOLEAN DEFAULT FALSE,
    reply_content TEXT,
    replied_at TIMESTAMP WITH TIME ZONE,
    external_comment_id TEXT,
    external_post_id TEXT,
    sentiment_score REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Engagement metrics (depends on social_posts)
CREATE TABLE social_engagement_metrics (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES social_posts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SPRINT 4: CRISIS ALERTS & MONITORING
-- =====================================================

-- Crisis alerts (depends on social_posts)
CREATE TABLE crisis_alerts (
    id SERIAL PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    platform TEXT,
    post_id INTEGER REFERENCES social_posts(id) ON DELETE SET NULL,
    metrics_snapshot TEXT,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SPRINT 5: A/B TESTING
-- =====================================================

-- A/B tests (no dependencies)
CREATE TABLE ab_tests (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    test_type TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    metric_criteria TEXT DEFAULT 'engagement',
    duration_hours INTEGER DEFAULT 48,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    winner_variant_id INTEGER,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- A/B test variants (depends on ab_tests)
CREATE TABLE ab_test_variants (
    id SERIAL PRIMARY KEY,
    ab_test_id INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    social_post_id INTEGER REFERENCES social_posts(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    reach INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    revenue_cents INTEGER DEFAULT 0,
    engagement_score REAL,
    reach_count INTEGER,
    performance_score REAL DEFAULT 0,
    is_winner BOOLEAN DEFAULT FALSE
);

-- =====================================================
-- SPRINT 6: REPORTING & ANALYTICS
-- =====================================================

-- Report subscriptions (no dependencies)
CREATE TABLE report_subscriptions (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    report_type TEXT DEFAULT 'weekly_social',
    day_of_week INTEGER,
    day_of_month INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hashtag performance (no dependencies)
CREATE TABLE hashtag_performance (
    id SERIAL PRIMARY KEY,
    hashtag TEXT NOT NULL,
    platform TEXT NOT NULL,
    posts_count INTEGER DEFAULT 0,
    avg_reach INTEGER DEFAULT 0,
    avg_engagement INTEGER DEFAULT 0,
    avg_ctr REAL DEFAULT 0,
    best_performing_post_id INTEGER,
    trending_score REAL DEFAULT 0,
    last_calculated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(hashtag, platform)
);

-- Content predictions (no dependencies on other social tables)
CREATE TABLE content_predictions (
    id SERIAL PRIMARY KEY,
    content_type TEXT NOT NULL,
    content_id INTEGER NOT NULL,
    predicted_reach INTEGER,
    predicted_engagement INTEGER,
    predicted_ctr REAL,
    confidence_score REAL,
    prediction_model TEXT,
    actual_reach INTEGER,
    actual_engagement INTEGER,
    actual_ctr REAL,
    accuracy_delta REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- SPRINT 7: AGENT INTEGRATION
-- =====================================================

-- Agent API keys (no dependencies)
CREATE TABLE social_agent_keys (
    id SERIAL PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT,
    scopes TEXT NOT NULL,
    rate_limit INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent audit log (depends on social_agent_keys)
CREATE TABLE agent_audit_log (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES social_agent_keys(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id INTEGER,
    request_payload TEXT,
    response_summary TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hashtag suggestions (depends on social_posts)
CREATE TABLE hashtag_suggestions (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES social_posts(id) ON DELETE CASCADE,
    hashtag TEXT NOT NULL,
    relevance_score REAL,
    trend_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sentiment scores (depends on social_posts)
CREATE TABLE sentiment_scores (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES social_posts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    positive REAL DEFAULT 0,
    neutral REAL DEFAULT 0,
    negative REAL DEFAULT 0,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SPRINT 8: INFLUENCER MANAGEMENT
-- =====================================================

-- Influencers (no dependencies)
CREATE TABLE influencers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    handle TEXT NOT NULL,
    profile_url TEXT,
    follower_count INTEGER,
    engagement_rate REAL,
    niche TEXT,
    location TEXT,
    email TEXT,
    phone TEXT,
    notes TEXT,
    portfolio_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Influencer collaborations (depends on influencers)
CREATE TABLE influencer_collaborations (
    id SERIAL PRIMARY KEY,
    influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    campaign_name TEXT NOT NULL,
    status TEXT DEFAULT 'proposed',
    deliverables TEXT,
    compensation_cents INTEGER,
    product_value_cents INTEGER,
    start_date DATE,
    end_date DATE,
    content_requirements TEXT,
    approval_required BOOLEAN DEFAULT TRUE,
    tracking_code TEXT,
    posts_delivered INTEGER DEFAULT 0,
    reach_total INTEGER DEFAULT 0,
    engagement_total INTEGER DEFAULT 0,
    revenue_attributed_cents INTEGER DEFAULT 0,
    roi_percent INTEGER,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Influencer submissions (depends on influencer_collaborations)
CREATE TABLE influencer_submissions (
    id SERIAL PRIMARY KEY,
    collaboration_id INTEGER REFERENCES influencer_collaborations(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL,
    caption TEXT,
    media_urls TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    feedback TEXT,
    platform_post_id TEXT,
    performance_metrics TEXT
);

-- Brand safety scans (no dependencies)
CREATE TABLE brand_safety_scans (
    id SERIAL PRIMARY KEY,
    content_type TEXT NOT NULL,
    content_id INTEGER NOT NULL,
    content_text TEXT,
    is_safe BOOLEAN,
    risk_level TEXT,
    risk_categories TEXT,
    flagged_keywords TEXT,
    ai_explanation TEXT,
    reviewed_by TEXT,
    override_safe BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Moderation rules (no dependencies)
CREATE TABLE moderation_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    condition TEXT NOT NULL,
    pattern TEXT NOT NULL,
    action TEXT NOT NULL,
    auto_reply_text TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    match_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Moderation actions (depends on moderation_rules and social_engagement_events)
CREATE TABLE moderation_actions (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES moderation_rules(id) ON DELETE SET NULL,
    engagement_event_id INTEGER REFERENCES social_engagement_events(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SUPPORTING TABLES FOR DASHBOARD & ADMIN
-- =====================================================

-- Content templates
CREATE TABLE content_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT,
    content_type TEXT DEFAULT 'feed',
    template_text TEXT NOT NULL,
    variables TEXT,
    hashtags TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI model configurations
CREATE TABLE ai_model_configs (
    id SERIAL PRIMARY KEY,
    model_name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'openai',
    model_id TEXT NOT NULL,
    purpose TEXT DEFAULT 'content_generation',
    api_key_ref TEXT,
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 500,
    is_active BOOLEAN DEFAULT TRUE,
    config TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent API keys (for external AI agents)
CREATE TABLE agent_api_keys (
    id SERIAL PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT,
    scopes TEXT NOT NULL DEFAULT 'read',
    rate_limit INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent content submissions
CREATE TABLE agent_content_submissions (
    id SERIAL PRIMARY KEY,
    agent_key_id INTEGER REFERENCES agent_api_keys(id) ON DELETE SET NULL,
    post_id INTEGER REFERENCES social_posts(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    confidence_score REAL,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Media library
CREATE TABLE media_library (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    media_type TEXT DEFAULT 'image',
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    alt_text TEXT,
    tags TEXT,
    uploaded_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admin audit log
CREATE TABLE admin_audit_log (
    id SERIAL PRIMARY KEY,
    admin_email TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimal posting times (analytics-driven scheduling)
CREATE TABLE optimal_posting_times (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,  -- 0=Sunday, 6=Saturday
    hour_of_day INTEGER NOT NULL,  -- 0-23
    avg_reach REAL DEFAULT 0,
    avg_engagement REAL DEFAULT 0,
    avg_ctr REAL DEFAULT 0,
    sample_size INTEGER DEFAULT 0,
    confidence REAL DEFAULT 0,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, day_of_week, hour_of_day)
);

-- Competitors tracking
CREATE TABLE competitors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_handle TEXT NOT NULL,
    profile_url TEXT,
    notes TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE competitor_posts (
    id SERIAL PRIMARY KEY,
    competitor_id INTEGER REFERENCES competitors(id),
    platform_post_id TEXT NOT NULL,
    content TEXT,
    posted_at TEXT,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    engagement_rate FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Revenue attribution (UTM-based)
CREATE TABLE social_revenue_attribution (
    id SERIAL PRIMARY KEY,
    social_post_id INTEGER REFERENCES social_posts(id),
    order_id INTEGER,
    revenue_cents INTEGER DEFAULT 0,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- DEFAULT DATA
-- =====================================================

-- Seed default AI model configs
INSERT INTO ai_model_configs (model_name, provider, model_id, purpose, temperature, max_tokens, is_active) VALUES
    ('GPT-4o', 'openai', 'gpt-4o', 'content_generation', 0.7, 500, true),
    ('GPT-4o Mini', 'openai', 'gpt-4o-mini', 'hashtag_suggestions', 0.5, 200, true),
    ('Claude 3.5 Sonnet', 'anthropic', 'claude-3-5-sonnet-20241022', 'content_generation', 0.7, 500, false),
    ('Llama 3.1 8B', 'ollama', 'llama3.1:8b', 'content_generation', 0.7, 500, false);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_social_posts_platform ON social_posts(platform);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_at);
CREATE INDEX idx_engagement_events_post ON social_engagement_events(post_id);
CREATE INDEX idx_engagement_events_type ON social_engagement_events(event_type);
CREATE INDEX idx_engagement_metrics_post ON social_engagement_metrics(post_id);
CREATE INDEX idx_crisis_alerts_status ON crisis_alerts(is_acknowledged, is_resolved);
CREATE INDEX idx_crisis_alerts_severity ON crisis_alerts(severity);
CREATE INDEX idx_ab_tests_status ON ab_tests(status);
CREATE INDEX idx_ab_variants_test ON ab_test_variants(ab_test_id);
CREATE INDEX idx_hashtag_perf_hashtag ON hashtag_performance(hashtag, platform);
CREATE INDEX idx_content_pred_content ON content_predictions(content_type, content_id);
CREATE INDEX idx_influencer_collab_status ON influencer_collaborations(status);
CREATE INDEX idx_influencer_collab_influencer ON influencer_collaborations(influencer_id);
CREATE INDEX idx_influencer_submissions_status ON influencer_submissions(status);
CREATE INDEX idx_influencer_submissions_collab ON influencer_submissions(collaboration_id);
CREATE INDEX idx_brand_safety_content ON brand_safety_scans(content_type, content_id);
CREATE INDEX idx_moderation_rules_active ON moderation_rules(is_active, rule_type);
CREATE INDEX idx_moderation_actions_rule ON moderation_actions(rule_id);
CREATE INDEX idx_moderation_actions_event ON moderation_actions(engagement_event_id);
CREATE INDEX idx_hashtag_suggestions_post ON hashtag_suggestions(post_id);
CREATE INDEX idx_sentiment_scores_post ON sentiment_scores(post_id);
CREATE INDEX idx_agent_audit_key ON agent_audit_log(api_key_id);
CREATE INDEX idx_content_templates_platform ON content_templates(platform);
CREATE INDEX idx_ai_model_configs_active ON ai_model_configs(is_active);
CREATE INDEX idx_agent_api_keys_active ON agent_api_keys(is_active);
CREATE INDEX idx_agent_submissions_status ON agent_content_submissions(status);
CREATE INDEX idx_media_library_type ON media_library(media_type);
CREATE INDEX idx_admin_audit_action ON admin_audit_log(action);

INSERT INTO social_platform_configs (platform, display_name, enabled) VALUES
    ('facebook',  'Facebook',  FALSE),
    ('instagram', 'Instagram', FALSE),
    ('twitter',   'X/Twitter', FALSE),
    ('linkedin',  'LinkedIn',  FALSE),
    ('tiktok',    'TikTok',    FALSE)
ON CONFLICT (platform) DO NOTHING;
