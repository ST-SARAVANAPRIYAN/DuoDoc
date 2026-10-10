"""
IntelliDoc Centralized System Configuration
Provides configurable paths for checkpoints, uploads, hardware accelerators,
and external model locations.
"""

import os
import torch
from pathlib import Path
from typing import Dict, Any

# Root Project Directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Checkpoints Configuration (User-Configurable via Env or .env)
CHECKPOINT_DIR = Path(os.getenv("CHECKPOINT_DIR", BASE_DIR / "checkpoints"))
CUSTOM_MODEL_PATH = Path(os.getenv("CUSTOM_MODEL_PATH", CHECKPOINT_DIR / "best_model.pt"))
TOKENIZER_PATH = Path(os.getenv("TOKENIZER_PATH", CHECKPOINT_DIR / "tokenizer.json"))
VAL_MAP_PATH = Path(os.getenv("VAL_MAP_PATH", CHECKPOINT_DIR / "val_map.json"))

# Foundation VLM Path (Supports HF Hub ID or local directory path e.g. /path/to/qwen2-vl-2b)
VLM_MODEL_PATH = os.getenv("VLM_MODEL_PATH", "Qwen/Qwen2-VL-2B-Instruct")

# Storage & Uploads
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
RENDERS_DIR = Path(os.getenv("RENDERS_DIR", UPLOAD_DIR / "renders"))

# Benchmarks
BENCHMARK_DIR = Path(os.getenv("BENCHMARK_DIR", BASE_DIR / "data" / "benchmarks"))
FUNSD_DIR = BENCHMARK_DIR / "funsd"
CORPUS_DIR = Path(os.getenv("CORPUS_DIR", BASE_DIR / "data" / "corpus"))

# Ensure dynamic directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RENDERS_DIR, exist_ok=True)
os.makedirs(CHECKPOINT_DIR, exist_ok=True)

# Hardware Runtime
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DEVICE_NAME = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"


def get_system_status() -> Dict[str, Any]:
    """
    Returns live system status, hardware memory, and checkpoint availability.
    """
    custom_model_exists = CUSTOM_MODEL_PATH.exists()
    tokenizer_exists = TOKENIZER_PATH.exists()
    val_map_exists = VAL_MAP_PATH.exists()

    gpu_stats = {}
    if torch.cuda.is_available():
        gpu_stats = {
            "name": torch.cuda.get_device_name(0),
            "allocated_mb": round(torch.cuda.memory_allocated(0) / (1024 * 1024), 2),
            "reserved_mb": round(torch.cuda.memory_reserved(0) / (1024 * 1024), 2),
            "total_mb": round(torch.cuda.get_device_properties(0).total_memory / (1024 * 1024), 2)
        }

    return {
        "device": DEVICE,
        "device_name": DEVICE_NAME,
        "gpu": gpu_stats,
        "checkpoints": {
            "checkpoint_dir": str(CHECKPOINT_DIR),
            "custom_model": {
                "path": str(CUSTOM_MODEL_PATH),
                "exists": custom_model_exists,
                "size_mb": round(CUSTOM_MODEL_PATH.stat().st_size / (1024 * 1024), 2) if custom_model_exists else 0
            },
            "tokenizer": {
                "path": str(TOKENIZER_PATH),
                "exists": tokenizer_exists
            },
            "val_map": {
                "path": str(VAL_MAP_PATH),
                "exists": val_map_exists
            },
            "vlm": {
                "model_identifier": VLM_MODEL_PATH,
                "is_local_path": os.path.exists(VLM_MODEL_PATH)
            }
        }
    }
