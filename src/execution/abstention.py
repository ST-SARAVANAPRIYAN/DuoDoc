"""
Confidence Calibration & Safe Abstention Policy
Implements Slide 10: Stage 6 (Safety Gate: Confidence Calibration).

Prevents corrupting edits on ambiguous user commands by evaluating prediction entropy,
top candidate margins, and joint probability distributions across model heads.
"""

import math
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from enum import Enum


class AbstentionDecision(Enum):
    EXECUTE = "EXECUTE"
    REQUEST_CONFIRMATION = "REQUEST_CONFIRMATION"
    ABSTAIN = "ABSTAIN"


@dataclass
class AbstentionResult:
    decision: AbstentionDecision
    joint_confidence: float
    top1_prob: float
    margin: float
    reason: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision": self.decision.value,
            "joint_confidence": round(self.joint_confidence, 4),
            "top1_prob": round(self.top1_prob, 4),
            "margin": round(self.margin, 4),
            "reason": self.reason
        }


class SafeAbstentionPolicy:
    """
    Evaluates cross-modal model confidence and decides whether to execute, ask user confirmation, or abstain.
    """

    def __init__(
        self,
        min_execute_confidence: float = 0.65,
        min_execute_margin: float = 0.15,
        min_confirm_confidence: float = 0.35
    ):
        self.min_execute_confidence = min_execute_confidence
        self.min_execute_margin = min_execute_margin
        self.min_confirm_confidence = min_confirm_confidence

    def evaluate(
        self,
        grounding_probs: List[float],
        op_prob: float = 1.0,
        prop_prob: float = 1.0,
        val_prob: float = 1.0
    ) -> AbstentionResult:
        """
        Evaluates the model output distributions.
        """
        if not grounding_probs:
            return AbstentionResult(
                decision=AbstentionDecision.ABSTAIN,
                joint_confidence=0.0,
                top1_prob=0.0,
                margin=0.0,
                reason="No candidate elements provided for grounding."
            )

        sorted_probs = sorted(grounding_probs, reverse=True)
        top1 = sorted_probs[0]
        top2 = sorted_probs[1] if len(sorted_probs) > 1 else 0.0
        margin = top1 - top2

        joint_conf = top1 * op_prob * prop_prob * val_prob

        # 1. High Confidence & Decisive Margin -> EXECUTE
        if joint_conf >= self.min_execute_confidence and margin >= self.min_execute_margin:
            return AbstentionResult(
                decision=AbstentionDecision.EXECUTE,
                joint_confidence=joint_conf,
                top1_prob=top1,
                margin=margin,
                reason=f"High confidence ({joint_conf:.1%}) with decisive candidate margin ({margin:.1%})."
            )

        # 2. Moderate Confidence -> REQUEST_CONFIRMATION
        elif joint_conf >= self.min_confirm_confidence:
            return AbstentionResult(
                decision=AbstentionDecision.REQUEST_CONFIRMATION,
                joint_confidence=joint_conf,
                top1_prob=top1,
                margin=margin,
                reason=f"Ambiguous instruction or close alternative candidate detected (margin {margin:.1%}). User confirmation required."
            )

        # 3. Low Confidence -> ABSTAIN
        else:
            return AbstentionResult(
                decision=AbstentionDecision.ABSTAIN,
                joint_confidence=joint_conf,
                top1_prob=top1,
                margin=margin,
                reason=f"Low model confidence ({joint_conf:.1%}). Operation safely blocked to avoid document corruption."
            )
