-- 038_sprint7_advanced_features.sql
-- Sprint 7: Best-Time-to-Post ML, A/B Testing, Competitor Tracking

-- Best-Time-to-Post: historical performance by hour/day
CREATE TABLE IF NOT EXISTS optimal_posting_times (
    id              SERIAL PRIMARY KEY,
    platform        TEXT NOT NULL,              -- 'instagram', 'facebook', 'linkedin', etc.
    day_of_week     INTEGER NOT NULL,           -- 0=Sunday, 6=Saturday
    hour_of_day     INTEGER NOT NULL,          -- 0-23
    avg_reach       INTEGER DEFAULT 0,          -- historical average reach
    avg_engagement  INTEGER DEFAULT 0,         -- historical average likes+comments+shares
    avg_ctr         REAL DEFAULT 0,           -- click-through rate
    sample_size     INTEGER DEFAULT 0,         -- how many posts inform this slot
    confidence      REAL DEFAULT 0,            -- 0.0 to 1.0 based on sample_size
    last_updated    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, day_of_week, hour_of_day)
);

-- A/B Testing: test variants of posts
CREATE TABLE IF NOT EXISTS ab_tests (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,              -- e.g. "Summer Sale Headline Test"
    platform        TEXT NOT NULL,
    test_type       TEXT NOT NULL DEFAULT 'headline',  -- 'headline' | 'image' | 'cta' | 'time'
    status          TEXT NOT NULL DEFAULT 'draft',     -- 'draft' | 'running' | 'completed' | 'cancelled'
    winning_variant_id INTEGER,               -- set when completed
    metric_criteria TEXT NOT NULL DEFAULT 'engagement',  -- 'engagement' | 'reach' | 'clicks' | 'revenue'
    duration_hours  INTEGER DEFAULT 48,       -- how long to run test
    start_time      TIMESTAMP WITH TIME ZONE,
    end_time        TIMESTAMP WITH TIME ZONE,
    created_by      TEXT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- A/B Test variants
CREATE TABLE IF NOT EXISTS ab_test_variants (
    id              SERIAL PRIMARY KEY,
    ab_test_id      INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
    variant_name    TEXT NOT NULL,              -- 'A' | 'B' | 'Control' | 'Emoji Version'
    content         TEXT NOT NULL,              -- the post content for this variant
    image_url       TEXT,
    scheduled_at    TIMESTAMP WITH TIME ZONE,   -- when this variant was/will be posted
    social_post_id  INTEGER REFERENCES social_posts(id),  -- linked after publishing
    -- Results (populated during/after test)
    reach           INTEGER DEFAULT 0,
    impressions     INTEGER DEFAULT 0,
    likes           INTEGER DEFAULT 0,
    comments        INTEGER DEFAULT 0,
    shares          INTEGER DEFAULT 0,
    clicks          INTEGER DEFAULT 0,
    revenue_cents   INTEGER DEFAULT 0,
    -- Calculated score based on metric_criteria
    performance_score REAL DEFAULT 0,
    is_winner       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Competitor tracking
CREATE TABLE IF NOT EXISTS competitors (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,              -- competitor brand name
    platform        TEXT NOT NULL,              -- 'instagram', 'facebook', etc.
    platform_handle TEXT NOT NULL,              -- @username or page name
    profile_url     TEXT,
    follower_count  INTEGER,                    -- last known
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Competitor posts (scraped/analyzed)
CREATE TABLE IF NOT EXISTS competitor_posts (
    id              SERIAL PRIMARY KEY,
    competitor_id   INTEGER REFERENCES competitors(id) ON DELETE CASCADE,
    platform_post_id TEXT NOT NULL,             -- their post ID
    content         TEXT,
    posted_at       TIMESTAMP WITH TIME ZONE,
    likes           INTEGER DEFAULT 0,
    comments        INTEGER DEFAULT 0,
    shares          INTEGER DEFAULT 0,
    -- AI analysis
    sentiment_score REAL,                       -- -1 to 1
    content_category TEXT,                      -- 'promotional' | 'educational' | 'entertaining' | 'ugc'
    engagement_rate REAL,                       -- calculated (likes+comments+shares)/followers
    -- Our analysis
    our_takeaway    TEXT,                       -- what we learned from this post
    should_respond  BOOLEAN DEFAULT FALSE,      -- flag if we should counter-post
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competitor_id, platform_post_id)
);

-- Social listening keyword matches (expanded beyond owned mentions)
CREATE TABLE IF NOT EXISTS social_listening_matches (
    id              SERIAL PRIMARY KEY,
    keyword_id      INTEGER REFERENCES social_listening_keywords(id),
    platform        TEXT NOT NULL,
    platform_post_id TEXT,                      -- if available
    author_handle   TEXT,
    content         TEXT,
    sentiment_score REAL,
    is_our_brand    BOOLEAN DEFAULT FALSE,      -- did we respond?
    engagement_count INTEGER,                   -- likes+shares+replies
    matched_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at    TIMESTAMP WITH TIME ZONE,
    response_content TEXT                       -- our reply if we engaged
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_optimal_times_platform
    ON optimal_posting_times (platform, day_of_week, hour_of_day);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests (status);
CREATE INDEX IF NOT EXISTS idx_ab_variants_test ON ab_test_variants (ab_test_id);
CREATE INDEX IF NOT EXISTS idx_competitor_posts_competitor
    ON competitor_posts (competitor_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_listening_matches_keyword
    ON social_listening_matches (keyword_id, matched_at DESC);
