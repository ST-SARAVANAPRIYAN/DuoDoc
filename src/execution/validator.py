"""
Action Safety Validator
Implements Slide 10: Stage 6 (Operation Execution: Safety & Constraint Validation).

Deterministic interceptor enforcing schema integrity and parameter validity
before any document mutation is permitted to execute.
"""

from typing import Tuple, Dict, Any, Optional
from schema import UnifiedDocument, DocumentElement, ElementStyle


ALLOWED_OPERATIONS = {
    "SET_STYLE",
    "HIGHLIGHT_ELEMENT",
    "RETRIEVE_INFO",
    "REPLACE_TEXT",
    "MOVE_ELEMENT",
    "DELETE_ELEMENT",
    "CLEAR_STYLE"
}

ALLOWED_PROPERTIES = {
    "bold": bool,
    "italic": bool,
    "underline": bool,
    "strikethrough": bool,
    "strike": bool,
    "subscript": bool,
    "superscript": bool,
    "text_case": str,
    "font_size": (int, float),
    "font_family": str,
    "alignment": str,
    "color": str,
    "highlight": bool,
    "indent": (int, float),
    "left_indent": (int, float),
    "line_spacing": (int, float),
    "letter_spacing": (int, float),
    "answer": str
}

ALLOWED_ALIGNMENTS = {"left", "center", "right", "justify"}
ALLOWED_CASES = {"uppercase", "lowercase", "capitalize", "titlecase", "none"}


COLOR_NAME_MAP = {
    "yellow": "#EAB308",
    "gold": "#D97706",
    "amber": "#D97706",
    "red": "#DC2626",
    "crimson": "#DC2626",
    "blue": "#2563EB",
    "sky": "#0284C7",
    "green": "#059669",
    "emerald": "#059669",
    "purple": "#7C3AED",
    "violet": "#7C3AED",
    "orange": "#EA580C",
    "black": "#0F172A",
    "dark": "#0F172A",
    "gray": "#64748B",
    "grey": "#64748B",
    "white": "#FFFFFF"
}


class ActionSafetyValidator:
    """
    Validates structural actions against document schema and semantic constraints.
    """

    @staticmethod
    def validate_action(
        doc: UnifiedDocument,
        target_element_id: str,
        operation: str,
        property_name: Optional[str] = None,
        value: Any = None,
        updates: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, str]:
        """
        Returns (is_valid: bool, reason: str).
        """
        # 1. Check Operation Validity
        if operation not in ALLOWED_OPERATIONS:
            return False, f"Unauthorized operation: '{operation}'. Permitted operations: {ALLOWED_OPERATIONS}"

        # 2. Check Target Element Existence
        found = doc.find_element(target_element_id)
        if found is None:
            return False, f"Target element '{target_element_id}' does not exist in document '{doc.document_id}'."

        page_idx, elem = found

        # 3. Read-only operation check (QA information retrieval)
        if operation == "RETRIEVE_INFO":
            return True, f"Read-only information retrieval permitted on element '{target_element_id}'."

        # 4. Check Updates dictionary if provided
        props_to_check: Dict[str, Any] = {}
        if updates:
            props_to_check.update(updates)
        elif property_name:
            props_to_check[property_name] = value

        for prop, val in props_to_check.items():
            if prop == "text":
                continue

            if prop not in ALLOWED_PROPERTIES:
                return False, f"Unknown style property: '{prop}'. Allowed: {list(ALLOWED_PROPERTIES.keys())}"

            # Check Property Constraints
            if prop == "font_size":
                try:
                    size = float(val)
                    if size < 6 or size > 72:
                        return False, f"Font size {size} out of allowable range [6, 72] pt."
                except (ValueError, TypeError):
                    return False, f"Invalid font size value: '{val}' (must be numeric)."

            elif prop == "alignment":
                align_str = str(val).lower()
                if align_str not in ALLOWED_ALIGNMENTS:
                    return False, f"Invalid alignment: '{val}'. Allowed: {ALLOWED_ALIGNMENTS}"

            elif prop in ("bold", "italic", "underline", "strikethrough", "strike", "highlight", "subscript", "superscript"):
                if not isinstance(val, bool) and str(val).lower() not in ("true", "false", "1", "0"):
                    return False, f"Boolean property '{prop}' received non-boolean value: '{val}'."

            elif prop == "text_case":
                case_str = str(val).lower()
                if case_str not in ALLOWED_CASES:
                    return False, f"Invalid text case: '{val}'. Allowed: {ALLOWED_CASES}"

            elif prop in ("indent", "left_indent"):
                try:
                    ind = float(val)
                    if ind < 0 or ind > 300:
                        return False, f"Indentation {ind} out of allowable range [0, 300] pt."
                except (ValueError, TypeError):
                    return False, f"Invalid indentation value: '{val}' (must be numeric)."

            elif prop == "line_spacing":
                try:
                    ls = float(val)
                    if ls < 0.5 or ls > 4.0:
                        return False, f"Line spacing {ls} out of allowable range [0.5, 4.0]."
                except (ValueError, TypeError):
                    return False, f"Invalid line spacing value: '{val}' (must be numeric)."

            elif prop == "letter_spacing":
                try:
                    ltr = float(val)
                    if ltr < -5.0 or ltr > 30.0:
                        return False, f"Letter spacing {ltr} out of allowable range [-5.0, 30.0] pt."
                except (ValueError, TypeError):
                    return False, f"Invalid letter spacing value: '{val}' (must be numeric)."

            elif prop == "font_family":
                if not isinstance(val, str) or len(val.strip()) == 0:
                    return False, f"Invalid font family name: '{val}'."

            elif prop == "color":
                col_str = str(val).strip().lower()
                if not (col_str.startswith("#") or col_str in COLOR_NAME_MAP):
                    return False, f"Invalid color format: '{val}'."

        return True, f"Action [{operation} on '{target_element_id}'] validated."
