"""
In-Memory Document & Model Session Store for Backend Operations
"""

import os
import sys
import json
import logging
import torch
from pathlib import Path
from typing import Dict, Any, Optional

# Ensure src is in sys.path
SRC_DIR = Path(__file__).resolve().parent.parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from schema import UnifiedDocument
from config import (
    CUSTOM_MODEL_PATH,
    TOKENIZER_PATH,
    VAL_MAP_PATH,
    VLM_MODEL_PATH,
    DEVICE,
    FUNSD_DIR,
    CORPUS_DIR
)
from models import (
    CorpusSubwordTokenizer,
    UnifiedDocumentIntelligenceModel,
    DualLayerVLMSystem,
    get_vlm_engine
)
from data import OP_MAP, PROP_MAP

logger = logging.getLogger("SessionStore")

# Store for active parsed UnifiedDocument objects: doc_id -> UnifiedDocument
DOCUMENTS: Dict[str, UnifiedDocument] = {}

# Cached Custom Model Artifacts
_CUSTOM_MODEL = None
_CUSTOM_TOKENIZER = None
_VAL_MAP = None
_INV_VAL_MAP = None


def get_document(doc_id: str) -> Optional[UnifiedDocument]:
    return DOCUMENTS.get(doc_id)


def store_document(doc_id: str, doc: UnifiedDocument):
    DOCUMENTS[doc_id] = doc


def get_vlm_engine_instance() -> DualLayerVLMSystem:
    return get_vlm_engine(model_id=VLM_MODEL_PATH)


def get_custom_model_bundle():
    """
    Lazy loads custom baseline model and tokenizer if available.
    """
    global _CUSTOM_MODEL, _CUSTOM_TOKENIZER, _VAL_MAP, _INV_VAL_MAP

    if _CUSTOM_MODEL is not None:
        return _CUSTOM_MODEL, _CUSTOM_TOKENIZER, _VAL_MAP, _INV_VAL_MAP

    if not CUSTOM_MODEL_PATH.exists() or not TOKENIZER_PATH.exists() or not VAL_MAP_PATH.exists():
        logger.warning(f"Custom model artifacts missing at {CUSTOM_MODEL_PATH}")
        return None, None, None, None

    try:
        tok = CorpusSubwordTokenizer.load(str(TOKENIZER_PATH))
        with open(VAL_MAP_PATH, "r", encoding="utf-8") as f:
            v_map = json.load(f)
        inv_v_map = {int(v): k for k, v in v_map.items()}

        checkpoint = torch.load(str(CUSTOM_MODEL_PATH), map_location=DEVICE, weights_only=False)
        hidden_dim = checkpoint.get("hidden_dim", 256)

        model = UnifiedDocumentIntelligenceModel(
            vocab_size=len(tok),
            hidden_dim=hidden_dim,
            max_text_len=64,
            image_size=224,
            patch_size=16,
            num_element_types=16,
            num_fusion_layers=4,
            num_heads=4,
            ff_dim=1024,
            num_operations=len(OP_MAP),
            num_properties=len(PROP_MAP),
            num_values=len(v_map),
            dropout=0.0
        ).to(DEVICE)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()

        _CUSTOM_MODEL = model
        _CUSTOM_TOKENIZER = tok
        _VAL_MAP = v_map
        _INV_VAL_MAP = inv_v_map
        return _CUSTOM_MODEL, _CUSTOM_TOKENIZER, _VAL_MAP, _INV_VAL_MAP
    except Exception as e:
        logger.error(f"Failed to load custom model: {e}")
        return None, None, None, None
