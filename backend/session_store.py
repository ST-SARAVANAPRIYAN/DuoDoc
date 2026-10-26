"""
In-Memory Document & Model Session Store for Backend Operations
"""

import os
import sys
import copy
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
    if doc_id in DOCUMENTS:
        return DOCUMENTS[doc_id]

    # Attempt restoration from MongoDB AST cache, uploads/ directory, or docs/ directory
    try:
        from config import UPLOAD_DIR, RENDERS_DIR
        from parser import DocxDocumentParser, PdfDocumentParser
        from render import render_canvas
        from database.mongodb import get_db

        # 1. Instant Cache-Hit: Check MongoDB document_asts collection
        try:
            db = get_db()
            if db is not None:
                ast_record = db["document_asts"].find_one({"document_id": doc_id})
                if ast_record and "ast" in ast_record:
                    cached_doc = UnifiedDocument.from_dict(ast_record["ast"])
                    # Verify page raster images exist on disk
                    renders_dir = RENDERS_DIR / doc_id
                    all_rasters_exist = all(
                        p.image_path and os.path.exists(p.image_path)
                        for p in cached_doc.pages
                    )
                    if all_rasters_exist:
                        DOCUMENTS[doc_id] = cached_doc
                        logger.info(f"Loaded document {doc_id} instantly from MongoDB AST cache (<10ms).")
                        return cached_doc
        except Exception as cache_err:
            logger.debug(f"MongoDB AST cache lookup failed for {doc_id}: {cache_err}")

        file_path = None
        # 2. Check database document records if available
        try:
            db = get_db()
            if db is not None:
                doc_record = db["documents"].find_one({"document_id": doc_id})
                if doc_record and doc_record.get("file_path") and os.path.exists(doc_record["file_path"]):
                    file_path = Path(doc_record["file_path"])
        except Exception:
            pass

        # 3. Search uploads/ directory
        if not file_path:
            for pattern in (f"{doc_id}_*.*", f"*{doc_id}*.*"):
                matches = [f for f in UPLOAD_DIR.glob(pattern) if f.suffix.lower() in (".docx", ".pdf", ".png", ".jpg", ".jpeg")]
                if matches:
                    file_path = matches[0]
                    break

        # 4. Search docs/ directory
        if not file_path:
            for f in Path("docs").glob("*.*"):
                if f.stem == doc_id or doc_id in f.name:
                    file_path = f
                    break

        if file_path and file_path.exists():
            doc_renders_dir = RENDERS_DIR / doc_id
            os.makedirs(doc_renders_dir, exist_ok=True)
            ext = file_path.suffix.lower()
            if ext in (".docx", ".doc"):
                parser = DocxDocumentParser(render_dpi=150)
                doc = parser.parse(str(file_path), output_image_dir=str(doc_renders_dir))
            else:
                parser = PdfDocumentParser(render_dpi=150)
                doc = parser.parse(str(file_path), output_image_dir=str(doc_renders_dir))

            for p_idx, page in enumerate(doc.pages):
                if not page.image_path or not os.path.exists(page.image_path):
                    img = render_canvas(doc, page_id=p_idx)
                    img_path = doc_renders_dir / f"page_{p_idx}.png"
                    img.save(img_path)
                    page.image_path = str(img_path)

            doc.document_id = doc_id
            DOCUMENTS[doc_id] = doc
            logger.info(f"Auto-restored document {doc_id} from {file_path.name}")

            # Persist to MongoDB AST cache for instant future retrieval
            try:
                db = get_db()
                if db is not None:
                    db["document_asts"].replace_one(
                        {"document_id": doc_id},
                        {"document_id": doc_id, "ast": doc.to_dict()},
                        upsert=True
                    )
            except Exception:
                pass

            return doc
    except Exception as e:
        logger.warning(f"Could not auto-restore document '{doc_id}': {e}")

    return None


def store_document(doc_id: str, doc: UnifiedDocument):
    DOCUMENTS[doc_id] = doc
    try:
        from database.mongodb import get_db
        db = get_db()
        if db is not None:
            db["document_asts"].replace_one(
                {"document_id": doc_id},
                {"document_id": doc_id, "ast": doc.to_dict()},
                upsert=True
            )
    except Exception as e:
        logger.debug(f"Could not persist document AST to MongoDB: {e}")


# Checkpoint Undo / Redo Transaction Stacks (Slide 10: Invertible Mutation Calculus)
DOCUMENT_CHECKPOINTS: Dict[str, list] = {}  # doc_id -> list of deepcopied UnifiedDocument
DOCUMENT_REDO_STACK: Dict[str, list] = {}   # doc_id -> list of deepcopied UnifiedDocument
MAX_CHECKPOINTS = 20


def push_checkpoint(doc_id: str, doc: UnifiedDocument):
    """Saves snapshot of document to undo stack before mutation, clearing redo stack."""
    if doc_id not in DOCUMENT_CHECKPOINTS:
        DOCUMENT_CHECKPOINTS[doc_id] = []
    DOCUMENT_CHECKPOINTS[doc_id].append(copy.deepcopy(doc))
    if len(DOCUMENT_CHECKPOINTS[doc_id]) > MAX_CHECKPOINTS:
        DOCUMENT_CHECKPOINTS[doc_id].pop(0)
    DOCUMENT_REDO_STACK[doc_id] = []


def undo_checkpoint(doc_id: str) -> Optional[UnifiedDocument]:
    """Rolls back document state to previous snapshot, pushing current state to redo stack."""
    current_doc = get_document(doc_id)
    if not current_doc or doc_id not in DOCUMENT_CHECKPOINTS or not DOCUMENT_CHECKPOINTS[doc_id]:
        return None
    prev_doc = DOCUMENT_CHECKPOINTS[doc_id].pop()
    if doc_id not in DOCUMENT_REDO_STACK:
        DOCUMENT_REDO_STACK[doc_id] = []
    DOCUMENT_REDO_STACK[doc_id].append(copy.deepcopy(current_doc))
    store_document(doc_id, prev_doc)
    return prev_doc


def redo_checkpoint(doc_id: str) -> Optional[UnifiedDocument]:
    """Reapplies next state from redo stack, pushing current state to undo stack."""
    current_doc = get_document(doc_id)
    if not current_doc or doc_id not in DOCUMENT_REDO_STACK or not DOCUMENT_REDO_STACK[doc_id]:
        return None
    next_doc = DOCUMENT_REDO_STACK[doc_id].pop()
    if doc_id not in DOCUMENT_CHECKPOINTS:
        DOCUMENT_CHECKPOINTS[doc_id] = []
    DOCUMENT_CHECKPOINTS[doc_id].append(copy.deepcopy(current_doc))
    store_document(doc_id, next_doc)
    return next_doc


def get_checkpoint_status(doc_id: str) -> Dict[str, int]:
    """Returns number of available undo and redo steps for doc_id."""
    return {
        "undo_count": len(DOCUMENT_CHECKPOINTS.get(doc_id, [])),
        "redo_count": len(DOCUMENT_REDO_STACK.get(doc_id, []))
    }



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


def get_qwopus_client_instance():
    """Returns singleton client instance for local Qwopus llama-server."""
    from models.vlm_engine import get_qwopus_client
    return get_qwopus_client()

