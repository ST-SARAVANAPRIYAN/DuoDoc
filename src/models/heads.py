"""
Dual Task Prediction Heads
Implements Slide 10: Stages 5A (Document Understanding) and 5B (Document Manipulation).

1. Element Grounding Pointer Head:
   Cross-attentive dot product between pooled instruction and candidate layout elements.
   - In Understanding (5A): Localizes supporting evidence elements for QA.
   - In Manipulation (5B): Localizes the target element to edit.
2. Structured Action Heads:
   Predicts Operation, Property, and Value for manipulation commands and extractive answers.
"""

import math
import torch
import torch.nn as nn
from typing import Dict, Any, Optional


class ElementGroundingPointerHead(nn.Module):
    """
    Pointer network scoring candidate document elements given the contextualized instruction.
    """

    def __init__(self, hidden_dim: int = 256):
        super().__init__()
        self.query_proj = nn.Linear(hidden_dim, hidden_dim)
        self.key_proj = nn.Linear(hidden_dim, hidden_dim)
        self.scale = 1.0 / math.sqrt(hidden_dim)

        self._init_weights()

    def _init_weights(self):
        nn.init.xavier_uniform_(self.query_proj.weight)
        nn.init.xavier_uniform_(self.key_proj.weight)
        if self.query_proj.bias is not None:
            nn.init.zeros_(self.query_proj.bias)
        if self.key_proj.bias is not None:
            nn.init.zeros_(self.key_proj.bias)

    def forward(
        self,
        pooled_text: torch.Tensor,       # [B, D]
        context_elements: torch.Tensor,  # [B, N_elem, D]
        elem_mask: Optional[torch.Tensor] = None # [B, N_elem] (1 for valid, 0 for padded)
    ) -> torch.Tensor:
        """
        Output:
            logits: [B, N_elem] (raw attention scores over elements)
        """
        # [B, 1, D]
        q = self.query_proj(pooled_text).unsqueeze(1)
        # [B, N_elem, D]
        k = self.key_proj(context_elements)

        # Dot-product attention: [B, 1, N_elem] -> [B, N_elem]
        scores = torch.bmm(q, k.transpose(1, 2)).squeeze(1) * self.scale

        # Mask invalid / padded elements with safe float16 lower bound
        if elem_mask is not None:
            fill_val = -1e4 if scores.dtype in (torch.float16, torch.bfloat16) else -1e9
            scores = scores.masked_fill(~elem_mask.bool(), fill_val)

        return scores


class StructuredActionHeads(nn.Module):
    """
    Classification heads for Operation, Property, and Action/Answer Value.
    """

    def __init__(
        self,
        hidden_dim: int = 256,
        num_operations: int = 6,
        num_properties: int = 6,
        num_values: int = 64,
        dropout: float = 0.1
    ):
        super().__init__()

        # Feature combiner: fuses pooled text and target element representation
        self.fusion_fc = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout)
        )

        # Operation Head (SET_STYLE, HIGHLIGHT, RETRIEVE_INFO, REPLACE_TEXT, etc.)
        self.op_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.GELU(),
            nn.Linear(hidden_dim // 2, num_operations)
        )

        # Property Head (bold, font_size, alignment, italic, color, answer)
        self.prop_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.GELU(),
            nn.Linear(hidden_dim // 2, num_properties)
        )

        # Value Head (parameter values + discrete answer values)
        self.val_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.GELU(),
            nn.Linear(hidden_dim // 2, num_values)
        )

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, pooled_text: torch.Tensor, target_elem_rep: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Input:
            pooled_text: [B, D]
            target_elem_rep: [B, D] (gathered representation of candidate target)
        Output:
            Dict containing operation_logits, property_logits, value_logits
        """
        combined = torch.cat([pooled_text, target_elem_rep], dim=-1)  # [B, 2*D]
        h = self.fusion_fc(combined)                                   # [B, D]

        return {
            "operation_logits": self.op_head(h),
            "property_logits": self.prop_head(h),
            "value_logits": self.val_head(h)
        }
