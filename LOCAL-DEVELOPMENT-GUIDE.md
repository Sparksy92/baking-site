# Local Development Guide - Social Platform

**How to test everything locally before production deployment.**

---

## Quick Start (5 minutes)

### 1. Start PostgreSQL

```bash
cd /home/rezzer/dev/clothing-ecommerce-baseline

# Start Postgres in Docker
docker-compose up -d db

# Verify
docker-compose ps
# Should show: ecommerce-db running
```

### 2. Set Up Environment

```bash
cd api

# Copy example if needed
cp ../.env.example .env  # or use existing .env

# Add social platform secrets (use test values for local dev)
echo "
# ─── Social Platform Test Configuration ──────────────────────
META_PAGE_ACCESS_TOKEN=test_token_for_local_dev_only
META_FACEBOOK_PAGE_ID=123456789
META_INSTAGRAM_ACCOUNT_ID=987654321

LINKEDIN_CLIENT_ID=test_client_id
LINKEDIN_CLIENT_SECRET=test_client_secret

TIKTOK_CLIENT_KEY=test_key
TIKTOK_CLIENT_SECRET=test_secret

# AI Services (get from OpenAI dashboard - free tier works)
OPENAI_API_KEY=sk-your-test-key
GEMINI_API_KEY=your-gemini-key

# Security (use test keys locally)
TOKEN_ENCRYPTION_SECRET=local_test_key_32_chars_long
WEBHOOK_SECRET=local_webhook_secret_32_chars
BACKUP_ENCRYPTION_KEY=local_backup_key_32_chars
" >> .env
```

### 3. Initialize Database

```bash
# Create virtual environment if needed
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python -c "
import asyncio
from app.database import init_db
asyncio.run(init_db())
print('✅ Database initialized')
"
```

### 4. Start API Server

```bash
# Option A: Direct Python (development)
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Option B: With log level
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --log-level debug
```

API is now running at: `http://localhost:8000`

### 5. Start Admin UI (Optional)

```bash
cd ../storefront
npm install  # if not done
npm run dev

# Admin UI at: http://localhost:3000/admin
```

---

## Testing the Social Platform Locally

### Test 1: Health Check

```bash
# Terminal 1
curl http://localhost:8000/api/health

# Expected: {"status": "ok"}
```

### Test 2: Create Admin User

```bash
# Create admin (one-time)
curl -X POST http://localhost:8000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123", "email": "admin@local.test"}'
```

### Test 3: Login & Get JWT

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  -c cookies.txt

# Or get JWT token directly:
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | jq -r '.access_token'
```

### Test 4: Test Social Dashboard

```bash
# Get JWT token
JWT=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | jq -r '.access_token')

# Test dashboard
curl http://localhost:8000/api/admin/social/dashboard \
  -H "Authorization: Bearer $JWT" | jq

# Test compact dashboard
curl http://localhost:8000/api/admin/social/dashboard/compact \
  -H "Authorization: Bearer $JWT"

# Test Gary Vee score
curl http://localhost:8000/api/admin/social/strategy/gary-vee-score \
  -H "Authorization: Bearer $JWT" | jq
```

### Test 5: Create Agent API Key

```bash
curl -X POST http://localhost:8000/api/admin/social/agents/keys \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "scopes": ["read:metrics", "write:drafts", "read:engagement"],
    "rate_limit_rpm": 100
  }' | jq

# Save the api_key from response
```

### Test 6: Test Agent API

```bash
# Use the key from previous step
AGENT_KEY="sk_live_abc123..."

# Agent health (no auth required)
curl http://localhost:8000/agent/v1/health

# Agent dashboard
curl http://localhost:8000/agent/v1/dashboard \
  -H "Authorization: Bearer $AGENT_KEY" | jq

# Submit draft
curl -X POST http://localhost:8000/agent/v1/drafts/social \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "instagram",
    "content": "Test post from local development! 🎉",
    "context": {"test": true}
  }' | jq
```

### Test 7: Test Brand Safety

```bash
# Scan safe content
curl -X POST http://localhost:8000/api/admin/social/brand-safety/scan \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Great product! Love it!",
    "content_type": "social_post"
  }' | jq

# Scan risky content
curl -X POST http://localhost:8000/api/admin/social/brand-safety/scan \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is spam!!! Click here!!! Buy now!!!",
    "content_type": "social_post"
  }' | jq
```

### Test 8: Test Posting Strategy

```bash
# Get current strategy
curl http://localhost:8000/api/admin/social/strategy \
  -H "Authorization: Bearer $JWT" | jq

# Update strategy (Gary Vee aggressive)
curl -X PUT http://localhost:8000/api/admin/social/strategy \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "instagram": {
      "posts_per_day": 5,
      "best_times": ["08:00", "12:00", "15:00", "18:00", "21:00"]
    }
  }' | jq

# Get daily plan
curl "http://localhost:8000/api/admin/social/strategy/daily-plan?date=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer $JWT" | jq
```

---

## Testing with Admin UI

### What's Available Now

| Feature | URL | Status |
|---------|-----|--------|
| Social Outbox | `/admin/social/outbox` | ✅ Basic UI |
| Brand Persona | `/admin/social/persona` | ✅ Basic UI |
| Platform Config | `/admin/social/platforms` | ✅ Basic UI |
| Dashboard | `/admin` | ⚠️ Ecommerce only, no social metrics |

### To Access

1. Start storefront: `npm run dev`
2. Go to: `http://localhost:3000/admin`
3. Login with admin credentials
4. Navigate to Social section in sidebar

---

## Admin UI: What's Missing

### Current State

The admin UI has **basic social features** but needs enhancement for the new Sprint features:

**✅ Already Working:**
- View social outbox (posts list with status)
- Edit/delete drafts
- Configure brand persona
- Connect platforms (Meta, LinkedIn)

**⚠️ Needs Enhancement:**

| Feature | Backend | Frontend | Priority |
|---------|---------|----------|----------|
| **Dashboard** | ✅ Complete | ❌ No social metrics | HIGH |
| **A/B Testing** | ✅ Complete | ❌ Not implemented | MEDIUM |
| **Competitor Tracking** | ✅ Complete | ❌ Not implemented | MEDIUM |
| **Influencer Management** | ✅ Complete | ❌ Not implemented | MEDIUM |
| **Brand Safety Scanner** | ✅ Complete | ❌ Not implemented | LOW |
| **Crisis Alerts** | ✅ Complete | ❌ Not implemented | HIGH |
| **Engagement Replies** | ✅ Complete | ❌ Not implemented | HIGH |
| **Gary Vee Strategy** | ✅ Complete | ❌ Not implemented | LOW |
| **Weekly Reports** | ✅ Complete | ❌ Not implemented | LOW |

### Dashboard Enhancement Needed

Current dashboard shows:
- Orders, Revenue, Customers, Subscribers
- Monthly/Weekly stats
- Low stock alerts

**Needs to add:**
- Social health score
- Pending approvals count
- Unreplied engagement count
- Active crisis alerts
- Platform performance mini-charts
- Gary Vee grade

### Do You Need Admin UI Updates?

**Option 1: API-First (Recommended for You)**
- You + AI agents use API endpoints directly
- Use tools like Postman, curl, or custom scripts
- Faster iteration, no frontend dev needed
- **Status: ✅ Ready now**

**Option 2: Enhanced Admin UI**
- Build out missing frontend pages
- Takes 2-3 days of React/Next.js work
- Better visual experience
- **Status: ⚠️ Needs development**

**Recommendation:** Start with API-only. Add UI later if you want visual dashboard.

---

## Full Local Test Script

Save as `test-social-local.sh`:

```bash
#!/bin/bash
set -e

BASE_URL="http://localhost:8000"
ADMIN_USER="admin"
ADMIN_PASS="admin123"

echo "🧪 Testing Social Platform Locally"
echo "===================================="

# 1. Health check
echo -n "1. Health check... "
curl -s $BASE_URL/api/health | grep -q "ok" && echo "✅" || echo "❌"

# 2. Login
echo -n "2. Login... "
JWT=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$ADMIN_USER\", \"password\": \"$ADMIN_PASS\"}" | jq -r '.access_token')
[ "$JWT" != "null" ] && echo "✅" || echo "❌"

# 3. Dashboard
echo -n "3. Dashboard... "
curl -s -H "Authorization: Bearer $JWT" $BASE_URL/api/admin/social/dashboard | jq -r '.data.health_score' > /dev/null && echo "✅" || echo "❌"

# 4. Create agent key
echo -n "4. Create agent key... "
AGENT_RESPONSE=$(curl -s -X POST $BASE_URL/api/admin/social/agents/keys \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "scopes": ["read:metrics"]}')
echo $AGENT_RESPONSE | jq -r '.api_key' | grep -q "sk_" && echo "✅" || echo "❌"

# 5. Agent API
echo -n "5. Agent dashboard... "
AGENT_KEY=$(echo $AGENT_RESPONSE | jq -r '.api_key')
curl -s -H "Authorization: Bearer $AGENT_KEY" $BASE_URL/agent/v1/dashboard | jq -r '.data.current_status' > /dev/null && echo "✅" || echo "❌"

# 6. Gary Vee score
echo -n "6. Gary Vee score... "
curl -s -H "Authorization: Bearer $JWT" $BASE_URL/api/admin/social/strategy/gary-vee-score | jq -r '.gary_vee_grade' > /dev/null && echo "✅" || echo "❌"

echo ""
echo "===================================="
echo "🎉 All tests completed!"
echo ""
echo "Admin JWT: $JWT"
echo "Agent Key: $AGENT_KEY"
echo ""
echo "Next steps:"
echo "  - Start storefront: cd storefront && npm run dev"
echo "  - Open admin: http://localhost:3000/admin"
echo "  - Or use API directly with the tokens above"
```

Make executable and run:
```bash
chmod +x test-social-local.sh
./test-social-local.sh
```

---

## Troubleshooting

### PostgreSQL Connection Fails

```bash
# Check if Docker is running
docker ps

# Check database logs
docker-compose logs db

# Reset database (WARNING: deletes data!)
docker-compose down -v
docker-compose up -d db
```

### API Won't Start

```bash
# Check virtualenv
which python
# Should show: .../.venv/bin/python

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall

# Check for port conflict
lsof -i :8000
# If something using port 8000, change in uvicorn command
```

### Missing Tables

```bash
# Force migrations
cd api
python -c "
import asyncio
from app.database import init_db
asyncio.run(init_db())
"
```

### Storefront Won't Connect to API

```bash
# Check .env.local in storefront/
cat storefront/.env.local
# Should have: NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Summary

| Task | Status | Command |
|------|--------|---------|
| Start database | ✅ | `docker-compose up -d db` |
| Install dependencies | ✅ | `pip install -r requirements.txt` |
| Start API | ✅ | `uvicorn app.main:app --reload` |
| Test all endpoints | ✅ | Use scripts above |
| Admin UI (basic) | ✅ | `npm run dev` → `/admin/social` |
| Admin UI (enhanced) | ⚠️ | Needs React development |

**Bottom Line:** You can test **100% of the social platform locally** via API. Admin UI has basic features but works. Enhanced UI is optional.
