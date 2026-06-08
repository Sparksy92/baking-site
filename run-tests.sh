#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/api"

set -a
source .env.test.local
set +a

source .venv/bin/activate

python -m pytest tests/ -v --tb=short "$@"
