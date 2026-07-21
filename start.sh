#!/bin/bash
set -e

echo "Starting The Artisan Bakery..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo >&2 "Docker is required but not installed. Aborting."; exit 1; }
command -v node >/dev/null 2>&1 || { echo >&2 "Node.js is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo >&2 "npm is required but not installed. Aborting."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo >&2 "Python 3 is required but not installed. Aborting."; exit 1; }

# Setup environments if missing
if [ ! -f .env ]; then
  echo "Copying .env.example to .env..."
  cp .env.example .env
fi

if [ ! -f storefront/.env ]; then
  echo "Copying storefront/.env.example to storefront/.env..."
  cp storefront/.env.example storefront/.env
fi

if [ ! -f storefront/.env.local ]; then
  echo "Copying storefront/.env.example to storefront/.env.local..."
  cp storefront/.env.example storefront/.env.local
fi

# Start DB
echo "Starting PostgreSQL database..."
docker compose up -d db

# Setup API
echo "Setting up backend (API)..."
cd api
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt

# Wait for DB to be ready
echo "Waiting for database to be ready..."
sleep 5

# Seed data and admin
echo "Seeding database and creating default admin..."
python cli.py seed || true
python cli.py seed-admin --username admin@theartisanbakery.test --password admin123 --display-name "Admin" || true

# Start API in the background
echo "Starting API server on port 8100..."
uvicorn app.main:create_app --factory --port 8100 &
API_PID=$!

# Setup Storefront
echo "Setting up storefront..."
cd ../storefront
npm install

echo "Starting Storefront on port 5173..."
npm run dev &
FRONTEND_PID=$!

echo "======================================================="
echo "The Artisan Bakery is running!"
echo "Storefront: http://localhost:5173"
echo "Admin Panel: http://localhost:5173/admin"
echo "Admin Email: admin@theartisanbakery.test"
echo "Admin Password: admin123"
echo "======================================================="
echo "Press Ctrl+C to stop both servers and database."

# Keep script running so we can kill both servers with Ctrl+C
trap "kill $API_PID $FRONTEND_PID; docker compose stop db; exit" SIGINT SIGTERM
wait
