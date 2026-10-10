#!/usr/bin/env bash
# Launch IntelliDoc React Frontend (Vite)
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR/frontend"

echo "=== Starting IntelliDoc React Frontend on http://localhost:5173 ==="
exec npm run dev -- --host 0.0.0.0
