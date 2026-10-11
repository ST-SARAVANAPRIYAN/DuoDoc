#!/usr/bin/env bash
# scripts/start_qwopus_server.sh: Starts llama-server for Qwopus3.5-9B-v3 with hybrid GPU offload

set -e

LLAMA_SERVER_BIN="/home/saravana/llama.cpp-nanbeige/build/bin/llama-server"

# Find Model Path
MODEL_PATH=""
if [ -f "models/qwopus/Qwopus3.5-9B-v3.Q4_K_M.gguf" ]; then
    MODEL_PATH="models/qwopus/Qwopus3.5-9B-v3.Q4_K_M.gguf"
elif [ -f "/home/saravana/Qwopus3.5-9B-v3.Q4_K_M.gguf" ]; then
    MODEL_PATH="/home/saravana/Qwopus3.5-9B-v3.Q4_K_M.gguf"
elif [ -f "/home/saravana/Downloads/Qwopus3.5-9B-v3.Q4_K_M.gguf" ]; then
    MODEL_PATH="/home/saravana/Downloads/Qwopus3.5-9B-v3.Q4_K_M.gguf"
fi

# Find Multimodal Projector
MMPROJ_PATH=""
if [ -f "models/qwopus/mmproj.gguf" ]; then
    MMPROJ_PATH="models/qwopus/mmproj.gguf"
elif [ -f "/home/saravana/mmproj.gguf" ]; then
    MMPROJ_PATH="/home/saravana/mmproj.gguf"
elif [ -f "/home/saravana/Downloads/mmproj.gguf" ]; then
    MMPROJ_PATH="/home/saravana/Downloads/mmproj.gguf"
fi

if [ -z "$MODEL_PATH" ]; then
    echo "ERROR: Qwopus3.5-9B-v3.Q4_K_M.gguf not found!"
    echo "Checked: models/qwopus/, /home/saravana/, /home/saravana/Downloads/"
    exit 1
fi

if [ -z "$MMPROJ_PATH" ]; then
    echo "WARNING: mmproj.gguf not found yet. Running text-only until mmproj finishes downloading."
    MMPROJ_FLAG=""
else
    echo "Found Multimodal Projector: $MMPROJ_PATH"
    MMPROJ_FLAG="--mmproj $MMPROJ_PATH --mmproj-offload"
fi

# Check if port 8085 is already occupied
if ss -tuln 2>/dev/null | grep -q ":8085 "; then
    echo "  [NOTICE] llama-server is already running on port 8085."
    exit 0
fi

echo "=========================================================="
echo "Starting Qwopus3.5-9B-v3 with llama-server on port 8085"
echo "Model: $MODEL_PATH"
echo "GPU Offload: 18 layers on NVIDIA RTX 4050 (~3.5 GB VRAM), 14 on RAM"
echo "Context Window: 8192 tokens"
echo "Host: 127.0.0.1:8085"
echo "=========================================================="

exec "$LLAMA_SERVER_BIN" \
    -m "$MODEL_PATH" \
    $MMPROJ_FLAG \
    --host 127.0.0.1 \
    --port 8085 \
    -ngl 18 \
    -c 8192 \
    -np 1 \
    --repeat-penalty 1.15 \
    --presence-penalty 0.15 \
    --frequency-penalty 0.15 \
    --reasoning-budget 80 \
    --reasoning-format deepseek-legacy

