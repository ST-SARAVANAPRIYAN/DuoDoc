#!/usr/bin/env bash
# Launch IntelliDoc FastAPI Backend Server
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=== Starting IntelliDoc FastAPI Backend on http://localhost:8000 ==="
export PYTHONPATH="$DIR/src:$DIR/backend:$PYTHONPATH"
exec "$DIR/.venv/bin/python" -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
