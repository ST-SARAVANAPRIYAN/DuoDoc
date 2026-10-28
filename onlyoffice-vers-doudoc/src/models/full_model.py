"""
Unified Multimodal Document Intelligence Model
Implements Slide 10: Complete Stages 3, 4, 5A, and 5B.

Integrates the Multimodal Backbone with Dual Task Heads:
- Grounding Pointer Head (Evidence Retrieval & Target Localization)
- Structured Action Heads (Operation, Property, Value Prediction)
"""

import torch
import torch.nn as nn
from typing import Dict, Any, Optional

from .backbone import MultimodalDocumentBackbone
from .heads import ElementGroundingPointerHead, StructuredActionHeads


class UnifiedDocumentIntelligenceModel(nn.Module):
    """
    Complete end-to-end multimodal deep learning model for document understanding & manipulation.
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
        num_operations: int = 6,
        num_properties: int = 6,
        num_values: int = 64,
        dropout: float = 0.1
    ):
        super().__init__()
        self.hidden_dim = hidden_dim

        # Multimodal Fusion Backbone
        self.backbone = MultimodalDocumentBackbone(
            vocab_size=vocab_size,
            hidden_dim=hidden_dim,
            max_text_len=max_text_len,
            image_size=image_size,
            patch_size=patch_size,
            num_element_types=num_element_types,
            num_fusion_layers=num_fusion_layers,
            num_heads=num_heads,
            ff_dim=ff_dim,
            dropout=dropout
        )

        # Grounding Pointer Head (Slide 10: 5A Evidence Retrieval & 5B Target Grounding)
        self.pointer_head = ElementGroundingPointerHead(hidden_dim=hidden_dim)

        # Action & Answer Prediction Heads (Slide 10: 5A QA & 5B Manipulation Actions)
        self.action_heads = StructuredActionHeads(
            hidden_dim=hidden_dim,
            num_operations=num_operations,
            num_properties=num_properties,
            num_values=num_values,
            dropout=dropout
        )

    def forward(
        self,
        text_ids: torch.Tensor,               # [B, L_text]
        page_images: torch.Tensor,            # [B, 3, 224, 224]
        elem_boxes: torch.Tensor,             # [B, N_elem, 6]
        elem_types: torch.Tensor,             # [B, N_elem]
        elem_mask: Optional[torch.Tensor] = None, # [B, N_elem]
        target_indices: Optional[torch.Tensor] = None # [B] (optional ground-truth target for training teacher-forcing)
    ) -> Dict[str, torch.Tensor]:
        """
        Executes full multimodal forward inference.
        """
        # 1. Forward through multimodal fusion backbone
        backbone_out = self.backbone(
            text_ids=text_ids,
            page_images=page_images,
            elem_boxes=elem_boxes,
            elem_types=elem_types,
            elem_mask=elem_mask
        )

        pooled_text = backbone_out["pooled_text"]          # [B, D]
        context_elements = backbone_out["context_elements"] # [B, N_elem, D]

        # 2. Grounding Pointer Head logits over candidate elements
        grounding_logits = self.pointer_head(
            pooled_text=pooled_text,
            context_elements=context_elements,
            elem_mask=elem_mask
        )  # [B, N_elem]

        # 3. Select target element representation (teacher forcing during training, argmax during inference)
        B = text_ids.shape[0]
        if target_indices is not None:
            selected_idx = target_indices.clamp(0, context_elements.shape[1] - 1)
        else:
            selected_idx = torch.argmax(grounding_logits, dim=-1)

        batch_indices = torch.arange(B, device=text_ids.device)
        target_elem_rep = context_elements[batch_indices, selected_idx, :]  # [B, D]

        # 4. Action & Answer prediction heads
        action_out = self.action_heads(pooled_text=pooled_text, target_elem_rep=target_elem_rep)

        return {
            "grounding_logits": grounding_logits,
            "operation_logits": action_out["operation_logits"],
            "property_logits": action_out["property_logits"],
            "value_logits": action_out["value_logits"],
            "pooled_text": pooled_text,
            "context_elements": context_elements
        }

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters() if p.requires_grad)
