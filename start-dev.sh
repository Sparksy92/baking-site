#!/bin/bash
# Development Environment Startup Script
# Usage: ./start-dev.sh

set -e

echo "=========================================="
echo "🚀 Starting Development Environment"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Start Database
echo ""
echo "📦 Step 1: Starting PostgreSQL..."
if podman ps | grep -q ecommerce-db; then
    echo "   Database already running"
else
    podman run -d --name ecommerce-db \
        -e POSTGRES_USER=ecommerce \
        -e POSTGRES_PASSWORD=ecommerce_dev_pass \
        -e POSTGRES_DB=ecommerce \
        -p 5432:5432 \
        docker.io/postgres:15-alpine 2>/dev/null || podman start ecommerce-db
    echo "   Waiting for PostgreSQL to initialize..."
    sleep 30
fi

# Verify DB is ready
echo "   Checking database..."
until podman exec ecommerce-db pg_isready -U ecommerce > /dev/null 2>&1; do
    echo "   ⏳ Waiting for PostgreSQL..."
    sleep 2
done
echo -e "${GREEN}   ✅ Database ready${NC}"

# 2. Start API
echo ""
echo "🔧 Step 2: Starting API..."
cd api
pkill -9 -f uvicorn 2>/dev/null || true
sleep 2

# Start API in background
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/api.log 2>&1 &
API_PID=$!
echo "   API starting (PID: $API_PID)..."

# Wait for API to be ready
echo "   Waiting for API..."
for i in {1..30}; do
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ API ready${NC}"
        break
    fi
    sleep 1
done

# 3. Seed admin user if needed
echo ""
echo "👤 Step 3: Ensuring admin user exists..."
.venv/bin/python3 << 'PYEOF'
import asyncio, asyncpg, sys
sys.path.insert(0, '.')
from app.auth import hash_password

async def seed_admin():
    try:
        conn = await asyncpg.connect(
            host='localhost', port=5432, user='ecommerce',
            password='ecommerce_dev_pass', database='ecommerce'
        )
        
        # Check if admin exists
        result = await conn.fetch("SELECT username FROM admin_users WHERE username='admin'")
        if not result:
            pw_hash = hash_password('admin123')
            await conn.execute(
                "INSERT INTO admin_users (username, password_hash, role) VALUES ($1, $2, $3)",
                'admin', pw_hash, 'owner'
            )
            print("   ✅ Admin user created")
        else:
            print("   ✅ Admin user exists")
        
        await conn.close()
    except Exception as e:
        print(f"   ⚠️  Warning: {e}")

asyncio.run(seed_admin())
PYEOF

# 4. Start Storefront (Admin UI)
echo ""
echo "🎨 Step 4: Starting Storefront (Admin UI)..."
cd ../storefront
pkill -9 -f "next" 2>/dev/null || true
sleep 2

# Start storefront in background
npm run dev > /tmp/storefront.log 2>&1 &
STORE_PID=$!
echo "   Storefront starting (PID: $STORE_PID)..."

# Wait for storefront to be ready
echo "   Waiting for Storefront..."
for i in {1..60}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Storefront ready${NC}"
        break
    fi
    sleep 1
done

# 5. Test
echo ""
echo "🧪 Step 5: Testing..."
HEALTH=$(curl -s http://localhost:8000/api/health | grep -o '"status":"ok"' || echo "FAIL")
if [ "$HEALTH" = '"status":"ok"' ]; then
    echo -e "${GREEN}   ✅ API Health check passed${NC}"
else
    echo -e "${RED}   ❌ API Health check failed${NC}"
fi

STORE=$(curl -s http://localhost:5173 | grep -o "html" || echo "FAIL")
if [ "$STORE" = "html" ]; then
    echo -e "${GREEN}   ✅ Storefront check passed${NC}"
else
    echo -e "${RED}   ❌ Storefront check failed${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}🎉 Environment Ready!${NC}"
echo "=========================================="
echo ""
echo "📋 Access Points:"
echo "   API:       http://localhost:8000"
echo "   Health:    http://localhost:8000/api/health"
echo "   Login:     http://localhost:8000/api/auth/login"
echo "   Admin UI:  http://localhost:5173/admin"
echo ""
echo "🔑 Credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "📊 Monitoring:"
echo "   API Logs:      tail -f /tmp/api.log"
echo "   Store Logs:    tail -f /tmp/storefront.log"
echo "   Stop All:      pkill -f uvicorn && pkill -f next && podman stop ecommerce-db"
echo ""
