# Qwopus 3.5 9B Multimodal Reasoning Engine

This directory houses the offline GGUF model binaries for the **Qwopus 3.5 9B** multimodal reasoning architecture.

---

## Model Components

| File | Size | Format | Description |
| :--- | :--- | :--- | :--- |
| **`Qwopus3.5-9B-v3.Q4_K_M.gguf`** | ~5.3 GB | GGUF (Q4_K_M) | 4-bit medium quantized Claude-distilled Qwen2.5 9B base model with native reasoning trace |
| **`mmproj.gguf`** | ~880 MB | GGUF Vision Projector | High-resolution visual projection module for document page bitmaps and diagrams |

---

## Runtime & Server Execution

The models are served locally via `llama-server` compiled with CUDA support:
* **Server Binary:** `/home/saravana/llama.cpp-nanbeige/build/bin/llama-server`
* **Local Endpoint:** `http://127.0.0.1:8085`
* **GPU Allocation:** 18 layers offloaded to NVIDIA RTX 4050 (~3.5 GB VRAM), 14 layers in RAM
* **Context Window:** 8,192 tokens
* **Launcher Script:** [`scripts/start_qwopus_server.sh`](../../scripts/start_qwopus_server.sh)

> **Note:** The `.gguf` weights files are excluded from Git version control via `.gitignore`.
