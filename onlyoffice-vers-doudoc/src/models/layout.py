"""
2D Spatial Layout Encoder
Implements Slide 10: Stage 3 (Layout / Positional Modality Encoding).

Encodes 2D normalized bounding box coordinates [x1, y1, x2, y2, w, h] and semantic
element type identities into a unified spatial layout embedding space.
"""

import torch
import torch.nn as nn


class DocumentLayoutEncoder(nn.Module):
    """
    Layout & Structural Encoder combining 2D spatial coordinate projection and element types.
    """

    def __init__(
        self,
        hidden_dim: int = 256,
        num_element_types: int = 16,
        dropout: float = 0.1
    ):
        super().__init__()
        self.hidden_dim = hidden_dim

        # 2-layer MLP projecting 6D spatial coordinates [x1, y1, x2, y2, w, h]
        self.spatial_mlp = nn.Sequential(
            nn.Linear(6, hidden_dim // 2),
            nn.GELU(),
            nn.Linear(hidden_dim // 2, hidden_dim)
        )

        # Semantic type embedding (heading, paragraph, table, cell, image, etc.)
        self.type_embedding = nn.Embedding(num_element_types, hidden_dim)

        self.norm = nn.LayerNorm(hidden_dim)
        self.dropout = nn.Dropout(dropout)

        self._init_weights()

    def _init_weights(self):
        for m in self.spatial_mlp:
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
        nn.init.normal_(self.type_embedding.weight, std=0.02)

    def forward(self, boxes: torch.Tensor, types: torch.Tensor) -> torch.Tensor:
        """
        Input:
            boxes: [Batch, NumElements, 6] (normalized coordinates in [0.0, 1.0])
            types: [Batch, NumElements] (integer element type IDs)
        Output:
            Layout tokens: [Batch, NumElements, HiddenDim]
        """
        # Spatial coordinate features: [B, N, D]
        spatial_feats = self.spatial_mlp(boxes)

        # Element type features: [B, N, D]
        type_feats = self.type_embedding(types)

        # Unified layout representation
        layout_tokens = self.norm(spatial_feats + type_feats)
        layout_tokens = self.dropout(layout_tokens)

        return layout_tokens
