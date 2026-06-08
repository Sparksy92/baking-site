#!/bin/bash
# Clean Deployment Script - Wipes everything and starts fresh

set -e

echo "=============================================="
echo "🧹 CLEAN DEPLOYMENT - Social Platform"
echo "=============================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

cd /home/rezzer/dev/clothing-ecommerce-baseline

echo ""
echo "Step 1: Stopping all services..."
pkill -9 -f uvicorn 2>/dev/null || true
docker stop ecommerce-db 2>/dev/null || true
docker rm ecommerce-db 2>/dev/null || true
echo -e "${GREEN}✓${NC} Services stopped"

echo ""
echo "Step 2: Starting fresh PostgreSQL..."
docker run -d --name ecommerce-db \
  --restart unless-stopped \
  -e POSTGRES_USER=ecommerce \
  -e POSTGRES_PASSWORD=ecommerce \
  -e POSTGRES_DB=ecommerce \
  -p 5432:5432 \
  postgres:15-alpine

echo -n "Waiting for database to be ready"
for i in {1..30}; do
    if docker exec ecommerce-db pg_isready -U ecommerce > /dev/null 2>&1; then
        echo -e "\n${GREEN}✓${NC} Database ready"
        break
    fi
    sleep 1
    echo -n "."
done

echo ""
echo "Step 3: Creating combined clean migration..."
cd api/app/migrations

# Create one clean migration with everything
cat > 040_social_platform_complete.sql << 'MIGRATEOF'
-- 040_social_platform_complete.sql
-- Clean combined migration for all social platform features
-- This replaces migrations 030-039

-- Drop existing social tables if they exist (clean slate)
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
DROP TABLE IF EXISTS social_engagement_metrics CASCADE;
DROP TABLE IF EXISTS social_engagement_events CASCADE;
DROP TABLE IF EXISTS social_posts CASCADE;
DROP TABLE IF EXISTS social_platform_configs CASCADE;
DROP TABLE IF EXISTS social_agent_keys CASCADE;
DROP TABLE IF EXISTS agent_audit_log CASCADE;
DROP TABLE IF EXISTS hashtag_suggestions CASCADE;
DROP TABLE IF EXISTS sentiment_scores CASCADE;

-- Sprint 1-3: Core Social Tables
CREATE TABLE social_platform_configs (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL UNIQUE,
    page_id TEXT,
    account_id TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    webhook_verify_token TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    settings TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE social_posts (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    content_type TEXT DEFAULT 'feed',
    content TEXT NOT NULL,
    image_url TEXT,
    video_url TEXT,
    link_url TEXT,
    external_post_id TEXT,
    status TEXT DEFAULT 'draft',
    scheduled_at TIMESTAMP,
    published_at TIMESTAMP,
    engagement_score REAL,
    reach_count INTEGER,
    revenue_attributed_cents INTEGER DEFAULT 0,
    orders_attributed INTEGER DEFAULT 0,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE social_engagement_events (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES social_posts(id),
    event_type TEXT NOT NULL,
    platform_user_id TEXT,
    platform_user_name TEXT,
    content TEXT,
    parent_event_id INTEGER,
    is_replied BOOLEAN DEFAULT FALSE,
    reply_content TEXT,
    replied_at TIMESTAMP,
    external_comment_id TEXT,
    external_post_id TEXT,
    sentiment_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE social_engagement_metrics (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES social_posts(id),
    platform TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sprint 4: Crisis Alerts & Monitoring
CREATE TABLE crisis_alerts (
    id SERIAL PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    platform TEXT,
    post_id INTEGER REFERENCES social_posts(id),
    metrics_snapshot TEXT,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by TEXT,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sprint 5: A/B Testing
CREATE TABLE ab_tests (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    test_type TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    metric_criteria TEXT DEFAULT 'engagement',
    duration_hours INTEGER DEFAULT 48,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    winner_variant_id INTEGER,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ab_test_variants (
    id SERIAL PRIMARY KEY,
    test_id INTEGER REFERENCES ab_tests(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    engagement_score REAL,
    reach_count INTEGER,
    published_at TIMESTAMP
);

-- Sprint 6: Reporting
CREATE TABLE report_subscriptions (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    report_type TEXT DEFAULT 'weekly_social',
    day_of_week INTEGER,
    day_of_month INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    last_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    last_calculated_at TIMESTAMP,
    UNIQUE(hashtag, platform)
);

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Sprint 7: Agent Integration
CREATE TABLE social_agent_keys (
    id SERIAL PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT,
    scopes TEXT NOT NULL,
    rate_limit INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agent_audit_log (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES social_agent_keys(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id INTEGER,
    request_payload TEXT,
    response_summary TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hashtag_suggestions (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES social_posts(id),
    hashtag TEXT NOT NULL,
    relevance_score REAL,
    trend_status TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sentiment_scores (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES social_posts(id),
    platform TEXT NOT NULL,
    positive REAL DEFAULT 0,
    neutral REAL DEFAULT 0,
    negative REAL DEFAULT 0,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sprint 8: Influencer Management
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE influencer_collaborations (
    id SERIAL PRIMARY KEY,
    influencer_id INTEGER REFERENCES influencers(id),
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE influencer_submissions (
    id SERIAL PRIMARY KEY,
    collaboration_id INTEGER REFERENCES influencer_collaborations(id),
    content_type TEXT NOT NULL,
    caption TEXT,
    media_urls TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    feedback TEXT,
    platform_post_id TEXT,
    performance_metrics TEXT
);

-- Sprint 8: Brand Safety
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE moderation_actions (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES moderation_rules(id),
    engagement_event_id INTEGER REFERENCES social_engagement_events(id),
    action_taken TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_social_posts_platform ON social_posts(platform);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_at);
CREATE INDEX idx_engagement_events_post ON social_engagement_events(post_id);
CREATE INDEX idx_engagement_events_type ON social_engagement_events(event_type);
CREATE INDEX idx_engagement_metrics_post ON social_engagement_metrics(post_id);
CREATE INDEX idx_crisis_alerts_status ON crisis_alerts(is_acknowledged, is_resolved);
CREATE INDEX idx_crisis_alerts_severity ON crisis_alerts(severity);
CREATE INDEX idx_ab_tests_status ON ab_tests(status);
CREATE INDEX idx_ab_variants_test ON ab_test_variants(test_id);
CREATE INDEX idx_hashtag_perf_hashtag ON hashtag_performance(hashtag, platform);
CREATE INDEX idx_content_pred_content ON content_predictions(content_type, content_id);
CREATE INDEX idx_influencer_collab_status ON influencer_collaborations(status);
CREATE INDEX idx_influencer_submissions_status ON influencer_submissions(status);
CREATE INDEX idx_brand_safety_content ON brand_safety_scans(content_type, content_id);
CREATE INDEX idx_moderation_rules_active ON moderation_rules(is_active, rule_type);
MIGRATEOF

echo -e "${GREEN}✓${NC} Clean migration created"

echo ""
echo "Step 4: Starting API..."
cd /home/rezzer/dev/clothing-ecommerce-baseline/api
source .venv/bin/activate

# Start API in background
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/api.log 2>&1 &

echo -n "Waiting for API to start"
for i in {1..60}; do
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        echo -e "\n${GREEN}✓${NC} API is running!"
        break
    fi
    sleep 1
    echo -n "."
done

echo ""
echo "Step 5: Creating admin user..."
python3 << 'PYEOF'
import asyncio
import sys
sys.path.insert(0, '.')
from app.database import get_db
from app.auth import hash_password

async def create_admin():
    async for db in get_db():
        try:
            # Create admin_users table if not exists
            await db.execute("""
                CREATE TABLE IF NOT EXISTS admin_users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT DEFAULT 'admin',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Check if admin exists
            cursor = await db.execute("SELECT id FROM admin_users WHERE username = 'admin'")
            existing = await cursor.fetchone()
            if existing:
                print("✓ Admin user already exists")
            else:
                pw_hash = hash_password('admin123')
                await db.execute(
                    "INSERT INTO admin_users (username, password_hash, role) VALUES ($1, $2, $3)",
                    ('admin', pw_hash, 'owner')
                )
                print("✓ Admin user created: admin / admin123")
            await db.commit()
        except Exception as e:
            print(f"⚠ Note: {e}")
        break

asyncio.run(create_admin())
PYEOF

echo ""
echo "=============================================="
echo -e "${GREEN}✅ CLEAN DEPLOYMENT COMPLETE${NC}"
echo "=============================================="
echo ""
echo "📍 URLs:"
echo "  API:   http://localhost:8000"
echo "  Admin: http://localhost:5173/admin"
echo ""
echo "🔑 Login:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "🧪 Test:"
echo "  curl http://localhost:8000/api/health"
echo ""
