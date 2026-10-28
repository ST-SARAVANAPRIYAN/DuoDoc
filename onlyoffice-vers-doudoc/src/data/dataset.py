"""
Multimodal Document PyTorch Dataset & DataLoader
Handles paired multimodal samples (Understanding QA & Grounded Manipulation).

Performs:
- Image loading, resizing to 224x224, and RGB tensor normalization
- 2D Bounding box normalization to [0.0, 1.0] and 6D coordinate expansion
- Text tokenization with dynamic padding
- Batch collation with element padding masks
"""

import os
import json
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms as T
from PIL import Image
from typing import List, Dict, Any, Tuple, Optional

from models import CorpusSubwordTokenizer


# Standard vocabulary maps for operations, properties, and element types
OP_MAP = {
    "SET_STYLE": 0,
    "HIGHLIGHT_ELEMENT": 1,
    "RETRIEVE_INFO": 2,
    "REPLACE_TEXT": 3,
    "MOVE_ELEMENT": 4,
    "DELETE_ELEMENT": 5
}
INV_OP_MAP = {v: k for k, v in OP_MAP.items()}

PROP_MAP = {
    "bold": 0,
    "font_size": 1,
    "alignment": 2,
    "italic": 3,
    "color": 4,
    "answer": 5
}
INV_PROP_MAP = {v: k for k, v in PROP_MAP.items()}

ELEM_TYPE_MAP = {
    "heading": 0,
    "paragraph": 1,
    "table": 2,
    "table_row": 3,
    "table_cell": 4,
    "image": 5,
    "chart": 6
}


def build_value_vocabulary(samples: List[Dict[str, Any]], max_vocab: int = 64) -> Tuple[Dict[str, int], Dict[int, str]]:
    vals = set()
    for s in samples:
        v = str(s.get("value", "")).strip().lower()
        if v:
            vals.add(v)
    val_map = {v: i for i, v in enumerate(sorted(list(vals))[:max_vocab])}
    inv_val_map = {i: v for v, i in val_map.items()}
    return val_map, inv_val_map


class MultimodalDocumentDataset(Dataset):
    """
    PyTorch Dataset loading multimodal documents, images, boxes, and instructions.
    """

    def __init__(
        self,
        manifest_path: str,
        tokenizer: CorpusSubwordTokenizer,
        val_map: Dict[str, int],
        image_dir: Optional[str] = None,
        max_text_len: int = 64,
        max_elements: int = 64
    ):
        self.manifest_path = manifest_path
        self.tokenizer = tokenizer
        self.val_map = val_map
        self.image_dir = image_dir
        self.max_text_len = max_text_len
        self.max_elements = max_elements

        with open(manifest_path, "r", encoding="utf-8") as f:
            self.samples = json.load(f)

        self.img_transform = T.Compose([
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        item = self.samples[idx]

        # 1. Resolve image path
        img_ref = item.get("page_image", "")
        if os.path.isabs(img_ref) and os.path.exists(img_ref):
            img_path = img_ref
        elif self.image_dir and os.path.exists(os.path.join(self.image_dir, img_ref)):
            img_path = os.path.join(self.image_dir, img_ref)
        elif os.path.exists(img_ref):
            img_path = img_ref
        else:
            # Fallback to a blank image if path unresolved
            img_path = None

        if img_path:
            try:
                img = Image.open(img_path).convert("RGB")
            except Exception:
                img = Image.new("RGB", (224, 224), color="#FFFFFF")
        else:
            img = Image.new("RGB", (224, 224), color="#FFFFFF")

        img_tensor = self.img_transform(img)

        # 2. Tokenize Instruction / Query
        instruction = item.get("instruction", "")
        text_ids = self.tokenizer.encode(instruction, max_length=self.max_text_len, add_special_tokens=True)

        # 3. Process candidate elements and bounding boxes
        raw_elements = item.get("elements", [])
        num_elem = min(len(raw_elements), self.max_elements)

        # Dynamically determine page dimensions for accurate normalization
        max_coord_x = max([el.get("bbox", [0, 0, 800, 1000])[2] for el in raw_elements] + [800.0])
        max_coord_y = max([el.get("bbox", [0, 0, 800, 1000])[3] for el in raw_elements] + [1000.0])
        page_w = max(800.0, float(max_coord_x))
        page_h = max(1000.0, float(max_coord_y))

        boxes = []
        types = []

        for el in raw_elements[:num_elem]:
            b = el.get("bbox", [0, 0, 0, 0])
            # Normalize to [0.0, 1.0]
            x1 = max(0.0, min(1.0, float(b[0]) / page_w))
            y1 = max(0.0, min(1.0, float(b[1]) / page_h))
            x2 = max(0.0, min(1.0, float(b[2]) / page_w))
            y2 = max(0.0, min(1.0, float(b[3]) / page_h))
            w = max(0.0, x2 - x1)
            h = max(0.0, y2 - y1)
            boxes.append([x1, y1, x2, y2, w, h])

            el_type = el.get("type", "paragraph")
            types.append(ELEM_TYPE_MAP.get(el_type, 1))

        # Pad elements up to max_elements
        pad_len = self.max_elements - num_elem
        elem_mask = [1.0] * num_elem + [0.0] * pad_len
        for _ in range(pad_len):
            boxes.append([0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
            types.append(0)

        # 4. Target labels
        target_idx = min(item.get("target_index", 0), self.max_elements - 1)
        op_id = OP_MAP.get(item.get("operation", "SET_STYLE"), 0)
        prop_id = PROP_MAP.get(item.get("property", "bold"), 0)
        val_str = str(item.get("value", "")).strip().lower()
        val_id = self.val_map.get(val_str, 0)

        return {
            "text_ids": torch.tensor(text_ids, dtype=torch.long),
            "page_image": img_tensor,
            "elem_boxes": torch.tensor(boxes, dtype=torch.float32),
            "elem_types": torch.tensor(types, dtype=torch.long),
            "elem_mask": torch.tensor(elem_mask, dtype=torch.float32),
            "target_idx": torch.tensor(target_idx, dtype=torch.long),
            "operation_id": torch.tensor(op_id, dtype=torch.long),
            "property_id": torch.tensor(prop_id, dtype=torch.long),
            "value_id": torch.tensor(val_id, dtype=torch.long)
        }


def collate_multimodal_batch(batch: List[Dict[str, Any]]) -> Dict[str, torch.Tensor]:
    """
    Collates samples into batch tensors.
    """
    return {
        "text_ids": torch.stack([item["text_ids"] for item in batch]),
        "page_images": torch.stack([item["page_image"] for item in batch]),
        "elem_boxes": torch.stack([item["elem_boxes"] for item in batch]),
        "elem_types": torch.stack([item["elem_types"] for item in batch]),
        "elem_mask": torch.stack([item["elem_mask"] for item in batch]),
        "target_indices": torch.stack([item["target_idx"] for item in batch]),
        "operation_ids": torch.stack([item["operation_id"] for item in batch]),
        "property_ids": torch.stack([item["property_id"] for item in batch]),
        "value_ids": torch.stack([item["value_id"] for item in batch])
    }
