#!/bin/bash
# OneScript + ONLYOFFICE Workspace Launch Script

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}=== Starting DuoDoc (ONLYOFFICE Native Edition)     ===${NC}"
echo -e "${BLUE}======================================================${NC}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$PROJECT_DIR/.." && pwd)"

# 0. Check & Start MongoDB (Port 27017)
if ! nc -z 127.0.0.1 27017 2>/dev/null && ! (echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null; then
    if command -v mongod >/dev/null 2>&1; then
        echo -e "${BLUE}[0/4] Starting local MongoDB instance on port 27017...${NC}"
        mkdir -p "$ROOT_DIR/data/db"
        mongod --dbpath "$ROOT_DIR/data/db" --port 27017 --bind_ip 127.0.0.1 --logpath "$ROOT_DIR/data/mongodb.log" --fork >/dev/null 2>&1 || true
        STARTED_MONGOD=true
    fi
fi

# 1. Check & Start Qwopus 3.5 9B llama-server (Port 8085)
echo -e "\n${BLUE}[1/4] Checking Qwopus 3.5 9B Server (Port 8085)...${NC}"
if ss -tuln 2>/dev/null | grep -q ":8085 "; then
    echo -e "${GREEN}✔ Qwopus llama-server is already active on port 8085.${NC}"
else
    echo "Launching Qwopus llama-server with RTX 4050 GPU offload..."
    "$ROOT_DIR/scripts/start_qwopus_server.sh" > "$PROJECT_DIR/qwopus.log" 2>&1 &
    QWOPUS_PID=$!
    for i in {1..12}; do
        if curl -s http://127.0.0.1:8085/health 2>/dev/null | grep -q '"ok"'; then
            echo -e "${GREEN}✔ Qwopus 3.5 9B online (PID: $QWOPUS_PID, port 8085).${NC}"
            break
        fi
        sleep 1
    done
fi

# 2. Check & Start ONLYOFFICE Docker Container (Port 9000)
echo -e "\n${BLUE}[2/4] Checking ONLYOFFICE Document Server...${NC}"
if docker ps | grep -q "onlyoffice-document-server"; then
    echo -e "${GREEN}✔ ONLYOFFICE is already running on port 9000.${NC}"
else
    echo "Starting existing ONLYOFFICE container..."
    docker start onlyoffice-document-server 2>/dev/null || (cd "$PROJECT_DIR" && docker compose up -d)
    sleep 3
    if docker ps | grep -q "onlyoffice-document-server"; then
        echo -e "${GREEN}✔ ONLYOFFICE started on port 9000.${NC}"
    else
        echo -e "${RED}Warning: ONLYOFFICE container failed to start. Check docker ps.${NC}"
    fi
fi

# 3. Check Python Virtualenv
VENV_PYTHON="$ROOT_DIR/.venv/bin/python"
VENV_UVICORN="$ROOT_DIR/.venv/bin/uvicorn"
if [ ! -f "$VENV_PYTHON" ]; then
    echo -e "${RED}Error: Virtualenv not found at $VENV_PYTHON${NC}"
    exit 1
fi

# 4. Start FastAPI Backend in Background (Port 8000)
echo -e "\n${BLUE}[3/4] Launching FastAPI Backend (Port 8000)...${NC}"
cd "$PROJECT_DIR"
PYTHONPATH="$PROJECT_DIR/src:$PROJECT_DIR/backend:$ROOT_DIR/src:$ROOT_DIR/backend:." "$VENV_UVICORN" backend.app:app --host 0.0.0.0 --port 8000 --reload > backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✔ FastAPI Backend running (PID: $BACKEND_PID, logs: backend.log)${NC}"

# 5. Start Frontend in Background (Port 5173)
echo -e "\n${BLUE}[4/4] Launching React Vite Frontend (Port 5173)...${NC}"
cd "$PROJECT_DIR/frontend"
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✔ React Frontend running (PID: $FRONTEND_PID, logs: frontend/frontend.log)${NC}"

# Trap Ctrl+C to cleanly kill all background jobs
cleanup() {
    echo -e "\n${YELLOW}Stopping DuoDoc services...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    if [ -n "$QWOPUS_PID" ]; then
        kill $QWOPUS_PID 2>/dev/null
    fi
    echo -e "${GREEN}All local services stopped.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}✔ DuoDoc Workspace is LIVE!${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "👉 ${BLUE}Frontend UI:${NC}         http://localhost:5173"
echo -e "👉 ${BLUE}FastAPI Docs:${NC}        http://localhost:8000/docs"
echo -e "👉 ${BLUE}ONLYOFFICE Server:${NC}   http://localhost:9000"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services.${NC}\n"

# Tail backend and frontend logs to console
wait
