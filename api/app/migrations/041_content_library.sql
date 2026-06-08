-- 041_content_library.sql
-- Evergreen content library and recycling system
-- Enables SocialBee/MeetEdgar-style content recycling

-- =====================================================
-- CONTENT LIBRARY (Evergreen recycling)
-- =====================================================

CREATE TABLE content_library (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT NOT NULL,  -- 'educational', 'entertaining', 'behind_scenes', 'community', 'promotional', 'evergreen'
    platform TEXT NOT NULL,
    image_url TEXT,
    video_url TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    max_uses INTEGER DEFAULT 10,
    min_days_between INTEGER DEFAULT 30,
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    total_engagement INTEGER DEFAULT 0,
    avg_engagement_per_use REAL DEFAULT 0,
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Track each time library content is used
CREATE TABLE content_library_usage (
    id SERIAL PRIMARY KEY,
    library_content_id INTEGER REFERENCES content_library(id) ON DELETE CASCADE,
    social_post_id INTEGER REFERENCES social_posts(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    engagement_at_use INTEGER DEFAULT 0
);

-- =====================================================
-- LINK IN BIO (Micro landing pages)
-- =====================================================

CREATE TABLE linkinbio_pages (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,  -- /l/{slug}
    title TEXT NOT NULL,
    subtitle TEXT,
    profile_image_url TEXT,
    background_color TEXT DEFAULT '#ffffff',
    text_color TEXT DEFAULT '#000000',
    button_color TEXT DEFAULT '#000000',
    button_text_color TEXT DEFAULT '#ffffff',
    font_family TEXT DEFAULT 'system-ui',
    is_active BOOLEAN DEFAULT TRUE,
    view_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    utm_source TEXT DEFAULT 'linkinbio',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Links on the bio page
CREATE TABLE linkinbio_links (
    id SERIAL PRIMARY KEY,
    page_id INTEGER REFERENCES linkinbio_pages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    button_text TEXT DEFAULT 'Shop Now',
    display_order INTEGER DEFAULT 0,
    is_highlighted BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    click_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    utm_campaign TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SOCIAL INBOX (Unified DMs/Comments)
-- =====================================================

CREATE TABLE social_conversations (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    platform_user_name TEXT,
    platform_user_avatar TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    unread_count INTEGER DEFAULT 0,
    is_flagged BOOLEAN DEFAULT FALSE,
    assigned_to TEXT,
    status TEXT DEFAULT 'open',  -- 'open', 'pending', 'resolved', 'spam'
    tags TEXT,  -- JSON array
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, platform_user_id)
);

-- Individual messages in conversations
CREATE TABLE social_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES social_conversations(id) ON DELETE CASCADE,
    platform_message_id TEXT,
    direction TEXT NOT NULL,  -- 'inbound', 'outbound'
    message_type TEXT DEFAULT 'text',  -- 'text', 'image', 'video', 'story_mention', 'comment'
    content TEXT NOT NULL,
    media_urls TEXT,  -- JSON array
    sent_at TIMESTAMP WITH TIME ZONE,
    is_read BOOLEAN DEFAULT FALSE,
    is_replied BOOLEAN DEFAULT FALSE,
    reply_content TEXT,
    replied_at TIMESTAMP WITH TIME ZONE,
    sentiment_score REAL,
    detected_intent TEXT,  -- 'question', 'complaint', 'praise', 'spam', 'sales'
    auto_reply_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PLATFORM VARIATIONS (Per-platform content adaptations)
-- =====================================================

CREATE TABLE platform_variations (
    id SERIAL PRIMARY KEY,
    base_post_id INTEGER REFERENCES social_posts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    adapted_content TEXT NOT NULL,
    adapted_hashtags TEXT,  -- JSON array
    character_count INTEGER,
    media_urls TEXT,  -- JSON array (can use different media per platform)
    is_primary BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'draft',  -- 'draft', 'approved', 'published', 'failed'
    platform_post_id TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    engagement_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- RSS AUTO-PUBLISHING
-- =====================================================

CREATE TABLE rss_feeds (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    platform TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    check_interval_minutes INTEGER DEFAULT 60,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    last_post_at TIMESTAMP WITH TIME ZONE,
    auto_publish BOOLEAN DEFAULT FALSE,
    content_template TEXT DEFAULT 'New post: {title} {url}',
    category TEXT DEFAULT 'educational',
    max_posts_per_day INTEGER DEFAULT 3,
    posts_today INTEGER DEFAULT 0,
    day_reset_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Track which RSS items have been posted
CREATE TABLE rss_items_posted (
    id SERIAL PRIMARY KEY,
    feed_id INTEGER REFERENCES rss_feeds(id) ON DELETE CASCADE,
    guid TEXT NOT NULL,
    title TEXT,
    url TEXT,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    social_post_id INTEGER REFERENCES social_posts(id) ON DELETE SET NULL
);

-- =====================================================
-- PUBLISH RETRY TRACKING (Sprint 3)
-- =====================================================

CREATE TABLE publish_retries (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES social_posts(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending',  -- 'pending', 'success', 'failed'
    result_message TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_publish_retries_post ON publish_retries(post_id);
CREATE INDEX idx_publish_retries_pending ON publish_retries(status, scheduled_at);

CREATE INDEX idx_content_library_platform ON content_library(platform);
CREATE INDEX idx_content_library_category ON content_library(category);
CREATE INDEX idx_content_library_approved ON content_library(is_approved, times_used, max_uses);
CREATE INDEX idx_content_library_usage_content ON content_library_usage(library_content_id);
CREATE INDEX idx_content_library_usage_post ON content_library_usage(social_post_id);

CREATE INDEX idx_linkinbio_slug ON linkinbio_pages(slug);
CREATE INDEX idx_linkinbio_active ON linkinbio_pages(is_active);
CREATE INDEX idx_linkinbio_links_page ON linkinbio_links(page_id);
CREATE INDEX idx_linkinbio_links_order ON linkinbio_links(page_id, display_order);

CREATE INDEX idx_social_conv_platform ON social_conversations(platform, platform_user_id);
CREATE INDEX idx_social_conv_status ON social_conversations(status, unread_count);
CREATE INDEX idx_social_conv_assigned ON social_conversations(assigned_to);
CREATE INDEX idx_social_messages_conv ON social_messages(conversation_id, sent_at);
CREATE INDEX idx_social_messages_unread ON social_messages(is_read, direction);

CREATE INDEX idx_platform_var_base ON platform_variations(base_post_id);
CREATE INDEX idx_platform_var_platform ON platform_variations(platform, status);

CREATE INDEX idx_rss_feeds_active ON rss_feeds(is_active);
CREATE INDEX idx_rss_items_feed ON rss_items_posted(feed_id);
CREATE INDEX idx_rss_items_guid ON rss_items_posted(feed_id, guid);
