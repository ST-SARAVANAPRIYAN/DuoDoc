#!/usr/bin/env bash
# =============================================================================
# IntelliDoc Unified Runner
# Launches FastAPI Backend (port 8000) and React Frontend (port 5173) concurrently.
# Pressing Ctrl+C cleanly terminates both servers and releases all ports/VRAM.
# =============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

# Clean up child processes on EXIT, SIGINT (Ctrl+C), or SIGTERM
cleanup() {
    echo ""
    echo "======================================================================"
    echo " Shutting down IntelliDoc servers..."
    echo "======================================================================"

    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo " Stopping React frontend (PID: $FRONTEND_PID)..."
        pkill -P "$FRONTEND_PID" 2>/dev/null || true
        kill -TERM "$FRONTEND_PID" 2>/dev/null || true
    fi

    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo " Stopping FastAPI backend (PID: $BACKEND_PID)..."
        pkill -P "$BACKEND_PID" 2>/dev/null || true
        kill -TERM "$BACKEND_PID" 2>/dev/null || true
    fi

    # Small grace wait
    wait "$BACKEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true

    echo " All services stopped cleanly. Ports 8000 & 5173 released."
    echo "======================================================================"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Start FastAPI Backend in background
export PYTHONPATH="$DIR/src:$DIR/backend:$PYTHONPATH"
"$DIR/.venv/bin/python" -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 2. Start React Frontend (Vite) in background
(cd "$DIR/frontend" && exec npm run dev -- --host 0.0.0.0 --port 5173) &
FRONTEND_PID=$!

echo ""
echo "======================================================================"
echo "  IntelliDoc Multimodal Document Intelligence System Running"
echo "======================================================================"
echo "  -> React Frontend : http://localhost:5173"
echo "  -> FastAPI Backend: http://localhost:8000 (API Docs: http://localhost:8000/docs)"
echo ""
echo "  [INFO] Press Ctrl+C at any time to stop both servers simultaneously."
echo "======================================================================"
echo ""

# Wait for both processes
wait -n "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
cleanup
