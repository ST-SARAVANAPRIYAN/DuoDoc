"""
Unit Tests for Phase 2 Deep Learning Architecture
"""

import os
import sys
import pytest
import torch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from models import (
    CorpusSubwordTokenizer,
    DocumentViTPatchEncoder,
    DocumentLayoutEncoder,
    CrossModalFusionTransformer,
    MultimodalDocumentBackbone
)


def test_tokenizer_training_and_encoding(tmp_path):
    corpus = [
        "Quarterly Financial Performance Report",
        "Net 30 days payable via corporate wire transfer upon receipt.",
        "Change font size to 16 pt and bold the heading."
    ]
    tok = CorpusSubwordTokenizer(vocab_size=100)
    tok.train_from_texts(corpus)

    assert len(tok) >= 20
    enc = tok.encode("Quarterly Financial Report", max_length=16)
    assert len(enc) == 16
    assert enc[0] == 2  # [CLS]

    # Save & reload
    save_path = str(tmp_path / "vocab.json")
    tok.save(save_path)
    loaded_tok = CorpusSubwordTokenizer.load(save_path)
    assert len(loaded_tok) == len(tok)
    assert loaded_tok.encode("Quarterly") == tok.encode("Quarterly")


def test_vit_patch_encoder():
    model = DocumentViTPatchEncoder(image_size=224, patch_size=16, hidden_dim=256)
    dummy_img = torch.randn(2, 3, 224, 224)
    tokens = model(dummy_img)

    # 224 / 16 = 14 -> 14*14 = 196 patches
    assert tokens.shape == (2, 196, 256)


def test_spatial_layout_encoder():
    model = DocumentLayoutEncoder(hidden_dim=256, num_element_types=16)
    dummy_boxes = torch.rand(2, 10, 6)
    dummy_types = torch.randint(0, 16, (2, 10))
    layout_tokens = model(dummy_boxes, dummy_types)

    assert layout_tokens.shape == (2, 10, 256)


def test_cross_modal_fusion_transformer():
    fusion = CrossModalFusionTransformer(hidden_dim=256, num_layers=2, num_heads=4, ff_dim=512)

    text_tokens = torch.randn(2, 16, 256)
    vision_tokens = torch.randn(2, 196, 256)
    layout_tokens = torch.randn(2, 10, 256)
    elem_mask = torch.ones(2, 10, dtype=torch.bool)
    elem_mask[:, 8:] = False  # last 2 padded

    outputs = fusion(text_tokens, vision_tokens, layout_tokens, elem_padding_mask=(~elem_mask))

    assert outputs["fused_sequence"].shape == (2, 16 + 196 + 10, 256)
    assert outputs["pooled_text"].shape == (2, 256)
    assert outputs["context_elements"].shape == (2, 10, 256)
    assert outputs["context_vision"].shape == (2, 196, 256)


def test_end_to_end_backbone_and_gpu():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    backbone = MultimodalDocumentBackbone(
        vocab_size=1000,
        hidden_dim=256,
        max_text_len=32,
        image_size=224,
        patch_size=16,
        num_fusion_layers=3,
        num_heads=4,
        ff_dim=512
    ).to(device)

    param_count = backbone.count_parameters()
    assert param_count > 1_000_000  # At least 1M params

    B, N_elem = 2, 8
    text_ids = torch.randint(0, 1000, (B, 32), device=device)
    images = torch.randn(B, 3, 224, 224, device=device)
    boxes = torch.rand(B, N_elem, 6, device=device)
    types = torch.randint(0, 16, (B, N_elem), device=device)
    elem_mask = torch.ones(B, N_elem, dtype=torch.float32, device=device)

    outputs = backbone(text_ids, images, boxes, types, elem_mask)
    assert "context_elements" in outputs
    assert outputs["context_elements"].shape == (B, N_elem, 256)
    assert outputs["pooled_text"].shape == (B, 256)


def test_dual_layer_vlm_helpers():
    from models import DualLayerVLMSystem
    from schema import DocumentElement, ElementStyle

    elements = [
        DocumentElement(id="e1", type="heading", page=0, bbox=[50.0, 50.0, 200.0, 80.0], text="Invoice Summary", style=ElementStyle(bold=True, font_size=18)),
        DocumentElement(id="e2", type="paragraph", page=0, bbox=[50.0, 90.0, 400.0, 110.0], text="Total Due: $1,250.00", style=ElementStyle(font_size=12))
    ]

    context_str = DualLayerVLMSystem.format_structural_elements(elements)
    assert "[e1]" in context_str
    assert "Invoice Summary" in context_str
    assert "[e2]" in context_str

    # Test JSON extraction
    sample_json = '```json\n{"target_id": "e1", "operation": "SET_STYLE", "property": "bold", "value": "true"}\n```'
    parsed = DualLayerVLMSystem._extract_json_payload(sample_json)
    assert parsed is not None
    assert parsed["target_id"] == "e1"
    assert parsed["operation"] == "SET_STYLE"
