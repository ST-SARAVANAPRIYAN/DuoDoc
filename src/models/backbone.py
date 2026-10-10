"""
Unified Multimodal Document Backbone
Implements Slide 10: Stage 3 (Multimodal Understanding & Fusion Core).

Integrates:
- Subword Token Embedding + Positional Encoding
- ViT Patch Image Projection (16x16)
- 2D Spatial Layout & Element Type Projection
- Cross-Modal Joint Attention Transformer
"""

import math
import torch
import torch.nn as nn
from typing import Dict, Any, Optional

from .vision import DocumentViTPatchEncoder
from .layout import DocumentLayoutEncoder
from .fusion import CrossModalFusionTransformer


class MultimodalDocumentBackbone(nn.Module):
    """
    End-to-End Multimodal Document Feature Extractor and Fusion Backbone.
    """

    def __init__(
        self,
        vocab_size: int = 4000,
        hidden_dim: int = 256,
        max_text_len: int = 64,
        image_size: int = 224,
        patch_size: int = 16,
        num_element_types: int = 16,
        num_fusion_layers: int = 4,
        num_heads: int = 4,
        ff_dim: int = 1024,
        dropout: float = 0.1
    ):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.max_text_len = max_text_len

        # 1. Text Encoder (Token Embedding + 1D Positional Embedding)
        self.token_embedding = nn.Embedding(vocab_size, hidden_dim)
        self.text_pos_embedding = nn.Parameter(torch.zeros(1, max_text_len, hidden_dim))
        self.text_norm = nn.LayerNorm(hidden_dim)
        self.text_dropout = nn.Dropout(dropout)

        # 2. Vision Encoder (ViT Patch Embedding)
        self.vision_encoder = DocumentViTPatchEncoder(
            image_size=image_size,
            patch_size=patch_size,
            in_channels=3,
            hidden_dim=hidden_dim,
            dropout=dropout
        )

        # 3. Spatial Layout Encoder (6D Bounding Boxes + Types)
        self.layout_encoder = DocumentLayoutEncoder(
            hidden_dim=hidden_dim,
            num_element_types=num_element_types,
            dropout=dropout
        )

        # 4. Cross-Modal Fusion Transformer
        self.fusion_transformer = CrossModalFusionTransformer(
            hidden_dim=hidden_dim,
            num_layers=num_fusion_layers,
            num_heads=num_heads,
            ff_dim=ff_dim,
            dropout=dropout
        )

        self._init_weights()

    def _init_weights(self):
        nn.init.normal_(self.token_embedding.weight, std=0.02)
        nn.init.normal_(self.text_pos_embedding, std=0.02)

    def forward(
        self,
        text_ids: torch.Tensor,               # [B, L_text]
        page_images: torch.Tensor,            # [B, 3, 224, 224]
        elem_boxes: torch.Tensor,             # [B, N_elem, 6]
        elem_types: torch.Tensor,             # [B, N_elem]
        elem_mask: Optional[torch.Tensor] = None # [B, N_elem] (1 for valid, 0 for padded)
    ) -> Dict[str, torch.Tensor]:
        """
        Executes end-to-end cross-modal representation learning.
        """
        B, L_text = text_ids.shape

        # 1. Encode Text
        text_emb = self.token_embedding(text_ids) + self.text_pos_embedding[:, :L_text, :]
        text_tokens = self.text_dropout(self.text_norm(text_emb))

        # 2. Encode Vision Patches
        vision_tokens = self.vision_encoder(page_images)

        # 3. Encode 2D Layout & Types
        layout_tokens = self.layout_encoder(elem_boxes, elem_types)

        # 4. Invert elem_mask for PyTorch MultiheadAttention key_padding_mask (True = mask out)
        elem_padding_mask = None
        if elem_mask is not None:
            elem_padding_mask = (~elem_mask.bool())

        # 5. Cross-Modal Fusion
        fusion_outputs = self.fusion_transformer(
            text_tokens=text_tokens,
            vision_tokens=vision_tokens,
            layout_tokens=layout_tokens,
            elem_padding_mask=elem_padding_mask
        )

        return fusion_outputs

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)
