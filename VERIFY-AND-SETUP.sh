#!/bin/bash
# Social Platform Verification & Setup Script
# Run this to verify all code is present and create test environment

set -e

echo "=============================================="
echo "🔍 VERIFYING SOCIAL PLATFORM SETUP"
echo "=============================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track status
ERRORS=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $2"
        return 0
    else
        echo -e "${RED}❌${NC} $2 - File missing: $1"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅${NC} $2"
        return 0
    else
        echo -e "${RED}❌${NC} $2 - Directory missing: $1"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

echo ""
echo "📦 CHECKING BACKEND SERVICES..."
check_file "api/app/services/social_publish_service.py" "Social Publish Service"
check_file "api/app/services/dashboard_service.py" "Dashboard Service"
check_file "api/app/services/posting_strategy_service.py" "Posting Strategy Service"
check_file "api/app/services/token_encryption_service.py" "Token Encryption (Security)"
check_file "api/app/services/webhook_security_service.py" "Webhook Security (Security)"
check_file "api/app/services/backup_service.py" "Backup Service (Security)"
check_file "api/app/services/brand_safety_service.py" "Brand Safety Service"
check_file "api/app/services/hashtag_service.py" "Hashtag Service"
check_file "api/app/services/engagement_service.py" "Engagement Service"
check_file "api/app/services/moderation_service.py" "Moderation Service"

echo ""
echo "🌐 CHECKING TIKTOK/YOUTUBE INTEGRATION..."
check_file "api/app/services/tiktok_service.py" "TikTok Service"
check_file "api/app/services/youtube_service.py" "YouTube Service"

echo ""
echo "🎨 CHECKING ADMIN UI PAGES..."
check_dir "storefront/app/admin/(panel)/social" "Social Directory"
check_file "storefront/app/admin/(panel)/social/page.tsx" "Dashboard Page"
check_file "storefront/app/admin/(panel)/social/outbox/page.tsx" "Outbox Page"
check_file "storefront/app/admin/(panel)/social/crisis/page.tsx" "Crisis Alerts Page"
check_file "storefront/app/admin/(panel)/social/strategy/page.tsx" "Strategy Page"
check_file "storefront/app/admin/(panel)/social/ab-tests/page.tsx" "A/B Tests Page"

echo ""
echo "📚 CHECKING DOCUMENTATION..."
check_file "OPERATIONAL-ITEMS.md" "Operational Items Guide"
check_file "LOCAL-DEVELOPMENT-GUIDE.md" "Local Development Guide"
check_file "docs/SOCIAL-PLATFORM-COMPLETE-GUIDE.md" "Social Platform Guide"
check_file "docs/AI-AGENT-INTEGRATION-GUIDE.md" "AI Agent Guide"
check_file "docs/SECURITY-ARCHITECTURE.md" "Security Architecture"

echo ""
echo "🔐 CHECKING SECURITY FILES..."
check_file "api/app/services/token_encryption_service.py" "Token Encryption"
check_file "api/app/services/webhook_security_service.py" "Webhook Security"

echo ""
echo "=============================================="

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL FILES PRESENT${NC}"
else
    echo -e "${RED}❌ $ERRORS FILES MISSING${NC}"
fi

echo ""
echo "=============================================="
echo "🚀 SETTING UP TEST ENVIRONMENT"
echo "=============================================="

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Start database
echo ""
echo "🐘 Starting PostgreSQL..."
cd "$(dirname "$0")"
docker-compose up -d db 2>/dev/null || docker compose up -d db

# Wait for database to be ready
echo "⏳ Waiting for database..."
for i in {1..30}; do
    if docker exec ecommerce-db pg_isready -U ecommerce > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database ready${NC}"
        break
    fi
    sleep 1
    echo -n "."
done

# Check Python environment
echo ""
echo "🐍 Checking Python environment..."
cd api
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate and install dependencies
source .venv/bin/activate
pip install -q -r requirements.txt
echo -e "${GREEN}✅ Python dependencies installed${NC}"

# Check if migrations need to run
echo ""
echo "🗄️  Initializing database..."
python -c "
import asyncio
import sys
sys.path.insert(0, '.')
from app.database import init_db
async def run():
    try:
        await init_db()
        print('✅ Database initialized')
    except Exception as e:
        print(f'⚠️  Database init warning: {e}')
asyncio.run(run())
" 2>/dev/null || echo "Database may already be initialized"

# Create admin user
echo ""
echo "👤 Creating test admin user..."
python -c "
import asyncio
import sys
sys.path.insert(0, '.')
from app.database import get_db
from app.auth import hash_password

async def create_admin():
    async for db in get_db():
        try:
            # Check if admin exists
            cursor = await db.execute('SELECT id FROM admin_users WHERE username = ?', ('admin',))
            existing = await cursor.fetchone()
            if existing:
                print('✅ Admin user already exists')
                print('   Username: admin')
                print('   Password: admin123')
            else:
                pw_hash = hash_password('admin123')
                await db.execute(
                    'INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)',
                    ('admin', pw_hash, 'owner')
                )
                await db.commit()
                print('✅ Admin user created')
                print('   Username: admin')
                print('   Password: admin123')
            break
        except Exception as e:
            print(f'⚠️  Note: {e}')
            break

asyncio.run(create_admin())
" 2>/dev/null || echo "Admin setup may need manual run"

echo ""
echo "=============================================="
echo "📋 TEST ENVIRONMENT READY"
echo "=============================================="

cat << 'EOF'

🎯 ACCESS INFORMATION
=====================

📍 API Endpoint:    http://localhost:8000
📍 Admin UI:        http://localhost:3000/admin

🔑 LOGIN CREDENTIALS
====================
Username: admin
Password: admin123

🚀 START COMMANDS
=================

Terminal 1 - API Server:
  cd api
  source .venv/bin/activate
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Terminal 2 - Admin UI:
  cd storefront
  npm run dev

📍 Then open: http://localhost:3000/admin

🔗 KEY URLS TO TEST
===================

Health Check:
  curl http://localhost:8000/api/health

Admin Login:
  curl -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "admin123"}'

Social Dashboard (after login):
  GET /api/admin/social/dashboard

🎨 ADMIN UI PAGES
=================

Main Dashboard:    http://localhost:3000/admin
Social Dashboard:  http://localhost:3000/admin/social
Outbox:            http://localhost:3000/admin/social/outbox
Crisis Alerts:     http://localhost:3000/admin/social/crisis
Strategy:          http://localhost:3000/admin/social/strategy
A/B Tests:         http://localhost:3000/admin/social/ab-tests
Brand Persona:     http://localhost:3000/admin/social/persona
Platforms:         http://localhost:3000/admin/social/platforms

✅ TEST WORKFLOW
================

1. Login at http://localhost:3000/admin
2. Go to http://localhost:3000/admin/pages
3. Create a blog post → Set status to "Published"
4. Check http://localhost:3000/admin/social/outbox
   → You should see auto-generated social drafts
5. Go to http://localhost:3000/admin/social
   → See dashboard with metrics
6. Edit a draft → Click "Approve"
7. Click "Publish" to post immediately

🔧 TROUBLESHOOTING
==================

If API won't start:
  - Check port 8000 is free: lsof -i :8000
  - Kill process: kill -9 <PID>

If database error:
  - Reset: docker-compose down -v && docker-compose up -d db

If UI won't connect:
  - Check storefront/.env.local has: NEXT_PUBLIC_API_URL=http://localhost:8000

📚 DOCUMENTATION
================

Local Dev Guide:   ./LOCAL-DEVELOPMENT-GUIDE.md
Operational Items: ./OPERATIONAL-ITEMS.md
Platform Guide:    ./docs/SOCIAL-PLATFORM-COMPLETE-GUIDE.md

EOF

echo ""
echo "=============================================="
echo -e "${GREEN}✅ SETUP COMPLETE${NC}"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Start API: cd api && .venv/bin/uvicorn app.main:app --reload"
echo "  2. Start UI:  cd storefront && npm run dev"
echo "  3. Login:     http://localhost:3000/admin"
echo "  4. Test:      Create a blog post → See social drafts"
echo ""
