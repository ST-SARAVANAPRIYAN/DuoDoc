"""
Cross-Modal Fusion Transformer
Implements Slide 10: Stage 3 (Multimodal Understanding & Fusion).

Jointly fuses Text, Vision, and 2D Spatial Layout tokens via Multi-Head Self-Attention,
learning deep cross-modal correlations between document text, page visual appearance,
and spatial layout bounding boxes.
"""

from enum import IntEnum
import math
import torch
import torch.nn as nn
from typing import Dict, Any, Tuple, Optional


class ModalityID(IntEnum):
    TEXT = 0
    VISION = 1
    LAYOUT = 2


class TransformerBlock(nn.Module):
    """
    Standard Pre-LN Transformer Encoder block with Multihead Attention and Feed-Forward MLP.
    """
    def __init__(self, hidden_dim: int = 256, num_heads: int = 4, ff_dim: int = 1024, dropout: float = 0.1):
        super().__init__()
        self.ln1 = nn.LayerNorm(hidden_dim)
        self.attn = nn.MultiheadAttention(
            embed_dim=hidden_dim,
            num_heads=num_heads,
            dropout=dropout,
            batch_first=True
        )
        self.ln2 = nn.LayerNorm(hidden_dim)
        self.mlp = nn.Sequential(
            nn.Linear(hidden_dim, ff_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(ff_dim, hidden_dim),
            nn.Dropout(dropout)
        )

    def forward(self, x: torch.Tensor, key_padding_mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        # Pre-LN Self-Attention
        normed = self.ln1(x)
        attn_out, _ = self.attn(normed, normed, normed, key_padding_mask=key_padding_mask)
        x = x + attn_out

        # Pre-LN Feed-Forward
        x = x + self.mlp(self.ln2(x))
        return x


class CrossModalFusionTransformer(nn.Module):
    """
    Centralized Cross-Modal Fusion Transformer backbone.
    """

    def __init__(
        self,
        hidden_dim: int = 256,
        num_layers: int = 4,
        num_heads: int = 4,
        ff_dim: int = 1024,
        dropout: float = 0.1
    ):
        super().__init__()
        self.hidden_dim = hidden_dim

        # Modality Type Embedding (Text=0, Vision=1, Layout=2)
        self.modality_embedding = nn.Embedding(3, hidden_dim)

        # Multi-layer Transformer Encoder stack
        self.layers = nn.ModuleList([
            TransformerBlock(
                hidden_dim=hidden_dim,
                num_heads=num_heads,
                ff_dim=ff_dim,
                dropout=dropout
            )
            for _ in range(num_layers)
        ])

        self.final_norm = nn.LayerNorm(hidden_dim)
        self._init_weights()

    def _init_weights(self):
        nn.init.normal_(self.modality_embedding.weight, std=0.02)

    def forward(
        self,
        text_tokens: torch.Tensor,    # [B, L_text, D]
        vision_tokens: torch.Tensor,  # [B, N_patches, D]
        layout_tokens: torch.Tensor,  # [B, N_elem, D]
        elem_padding_mask: Optional[torch.Tensor] = None # [B, N_elem] (True for padded)
    ) -> Dict[str, torch.Tensor]:
        """
        Fuses modalities into a shared cross-attention sequence.
        """
        B = text_tokens.shape[0]
        L_text = text_tokens.shape[1]
        N_vision = vision_tokens.shape[1]
        N_elem = layout_tokens.shape[1]

        # 1. Add Modality Indicators
        mod_text = self.modality_embedding(torch.tensor(ModalityID.TEXT, device=text_tokens.device))
        mod_vision = self.modality_embedding(torch.tensor(ModalityID.VISION, device=vision_tokens.device))
        mod_layout = self.modality_embedding(torch.tensor(ModalityID.LAYOUT, device=layout_tokens.device))

        text_seq = text_tokens + mod_text
        vision_seq = vision_tokens + mod_vision
        layout_seq = layout_tokens + mod_layout

        # 2. Concatenate into Joint Multimodal Sequence: [Text | Vision | Layout]
        fused_seq = torch.cat([text_seq, vision_seq, layout_seq], dim=1)  # [B, L_total, D]

        # 3. Construct unified key padding mask if provided
        key_padding_mask = None
        if elem_padding_mask is not None:
            # text and vision tokens are always unmasked (False)
            text_mask = torch.zeros((B, L_text), dtype=torch.bool, device=text_tokens.device)
            vision_mask = torch.zeros((B, N_vision), dtype=torch.bool, device=vision_tokens.device)
            # elem_padding_mask is True for padded positions
            key_padding_mask = torch.cat([text_mask, vision_mask, elem_padding_mask.bool()], dim=1)

        # 4. Process through Cross-Modal Transformer Blocks
        for layer in self.layers:
            fused_seq = layer(fused_seq, key_padding_mask=key_padding_mask)

        fused_seq = self.final_norm(fused_seq)

        # 5. Extract Contextual Representations
        context_text = fused_seq[:, :L_text, :]
        context_vision = fused_seq[:, L_text:L_text + N_vision, :]
        context_elements = fused_seq[:, L_text + N_vision:, :]

        # Text [CLS] pooled representation at index 0
        pooled_text = context_text[:, 0, :]

        return {
            "fused_sequence": fused_seq,
            "pooled_text": pooled_text,
            "context_text": context_text,
            "context_vision": context_vision,
            "context_elements": context_elements
        }
