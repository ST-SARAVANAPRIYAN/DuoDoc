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

    if [ -n "$QWOPUS_PID" ] && kill -0 "$QWOPUS_PID" 2>/dev/null; then
        echo " Stopping Qwopus llama-server (PID: $QWOPUS_PID)..."
        pkill -P "$QWOPUS_PID" 2>/dev/null || true
        kill -TERM "$QWOPUS_PID" 2>/dev/null || true
    fi

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

    if [ "$STARTED_MONGOD" = "true" ]; then
        echo " Stopping local MongoDB instance..."
        mongod --dbpath "$DIR/data/db" --shutdown >/dev/null 2>&1 || pkill -f "mongod --dbpath $DIR/data/db" >/dev/null 2>&1 || true
    fi

    # Small grace wait
    wait "$BACKEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
    wait "$QWOPUS_PID" 2>/dev/null || true

    echo " All services stopped cleanly. Ports 8000, 5173 & 8085 released."
    echo "======================================================================"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 0. Check & launch local MongoDB if not already listening on port 27017
STARTED_MONGOD=false
if ! nc -z 127.0.0.1 27017 2>/dev/null && ! (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null; then
    if command -v mongod >/dev/null 2>&1; then
        echo "  [DATABASE] Starting local MongoDB instance on port 27017..."
        mkdir -p "$DIR/data/db"
        mongod --dbpath "$DIR/data/db" --port 27017 --bind_ip 127.0.0.1 --logpath "$DIR/data/mongodb.log" --fork >/dev/null 2>&1 || true
        STARTED_MONGOD=true
    else
        echo "  [NOTICE] mongod not found. System will utilize resilient local database mode."
    fi
fi

# 1. Launch Qwopus llama-server on port 8085 as default intelligence backend
START_QWOPUS=true
for arg in "$@"; do
    if [ "$arg" = "--no-qwopus" ]; then
        START_QWOPUS=false
    fi
done

if [ "$START_QWOPUS" = "true" ]; then
    if [ -f "models/qwopus/Qwopus3.5-9B-v3.Q4_K_M.gguf" ] || [ -f "$HOME/Qwopus3.5-9B-v3.Q4_K_M.gguf" ] || [ -f "$HOME/Downloads/Qwopus3.5-9B-v3.Q4_K_M.gguf" ]; then
        echo "  [DEFAULT] Launching Qwopus3.5-9B-v3 llama-server on port 8085..."
        "$DIR/scripts/start_qwopus_server.sh" &
        QWOPUS_PID=$!
    else
        echo "  [NOTICE] Qwopus GGUF model not found in standard paths. Running backend in standard mode."
    fi
else
    echo "  [INFO] --no-qwopus flag detected. Qwopus server deferred."
fi

# 2. Start FastAPI Backend in background
export PYTHONPATH="$DIR/src:$DIR/backend:$PYTHONPATH"
"$DIR/.venv/bin/python" -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload --reload-dir "$DIR/backend" --reload-dir "$DIR/src" &
BACKEND_PID=$!

# 3. Start React Frontend (Vite) in background
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
