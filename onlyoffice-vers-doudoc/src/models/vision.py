"""
Vision Transformer (ViT) Patch Embedding Encoder
Implements Slide 10: Stage 3 (Visual Modality Encoding).

Transforms high-resolution document page images (224x224) into 196 visual tokens
using 16x16 patch projection and learned positional embeddings.
"""

import math
import torch
import torch.nn as nn


class DocumentViTPatchEncoder(nn.Module):
    """
    Vision Transformer patch projection for document pages.
    """

    def __init__(
        self,
        image_size: int = 224,
        patch_size: int = 16,
        in_channels: int = 3,
        hidden_dim: int = 256,
        dropout: float = 0.1
    ):
        super().__init__()
        self.image_size = image_size
        self.patch_size = patch_size
        self.hidden_dim = hidden_dim

        assert image_size % patch_size == 0, f"Image size {image_size} must be divisible by patch size {patch_size}"
        self.num_patches = (image_size // patch_size) ** 2  # (224/16)^2 = 196

        # 2D Convolution acts as linear projection over non-overlapping patches
        self.patch_proj = nn.Conv2d(
            in_channels=in_channels,
            out_channels=hidden_dim,
            kernel_size=patch_size,
            stride=patch_size
        )

        # Learnable spatial positional embeddings for visual tokens
        self.pos_embedding = nn.Parameter(torch.zeros(1, self.num_patches, hidden_dim))
        self.norm = nn.LayerNorm(hidden_dim)
        self.dropout = nn.Dropout(dropout)

        self._init_weights()

    def _init_weights(self):
        # Truncated normal / Xavier initialization
        nn.init.xavier_uniform_(self.patch_proj.weight)
        if self.patch_proj.bias is not None:
            nn.init.zeros_(self.patch_proj.bias)
        nn.init.normal_(self.pos_embedding, std=0.02)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Input:
            x: [Batch, Channels, Height, Width] e.g. [B, 3, 224, 224]
        Output:
            Visual tokens: [Batch, NumPatches, HiddenDim] e.g. [B, 196, 256]
        """
        B = x.shape[0]

        # [B, 3, 224, 224] -> [B, D, 14, 14]
        patches = self.patch_proj(x)

        # [B, D, 14, 14] -> [B, D, 196] -> [B, 196, D]
        patches = patches.flatten(2).transpose(1, 2)

        # Add learned 2D positional embeddings
        tokens = patches + self.pos_embedding
        tokens = self.norm(tokens)
        tokens = self.dropout(tokens)

        return tokens
