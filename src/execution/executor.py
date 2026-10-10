"""
Document State Executor
Implements Slide 10: Stage 6 (Operation Execution).

Performs atomic, verified state transitions on the UnifiedDocument AST
and generates execution diff audits.
"""

import copy
from typing import Dict, Any, Tuple, Optional
from schema import UnifiedDocument, DocumentElement, ElementStyle
from .validator import ActionSafetyValidator, COLOR_NAME_MAP


class DocumentStateExecutor:
    """
    Applies validated structural and stylistic modifications to a UnifiedDocument.
    """

    @staticmethod
    def execute_action(
        doc: UnifiedDocument,
        target_element_id: str,
        operation: str,
        property_name: Optional[str] = None,
        value: Any = None,
        updates: Optional[Dict[str, Any]] = None
    ) -> Tuple[Optional[UnifiedDocument], Dict[str, Any]]:
        """
        Executes an action or compound updates on a deep copy of the document.
        Returns (modified_document, execution_audit).
        """
        # 1. Pre-Execution Safety Validation
        is_valid, validation_reason = ActionSafetyValidator.validate_action(
            doc, target_element_id, operation, property_name, value, updates=updates
        )
        if not is_valid:
            return None, {
                "success": False,
                "error": f"Safety Validator Intercept: {validation_reason}",
                "target_id": target_element_id,
                "operation": operation
            }

        # 2. Deep-copy document for safe atomic mutation
        doc_copy = copy.deepcopy(doc)
        found = doc_copy.find_element(target_element_id)
        if found is None:
            return None, {"success": False, "error": "Target element disappeared during execution."}

        page_idx, elem = found
        before_state = elem.to_dict()

        # 3. Assemble all property updates
        props_to_apply: Dict[str, Any] = {}
        if updates:
            props_to_apply.update(updates)
        elif property_name:
            props_to_apply[property_name] = value

        if operation == "HIGHLIGHT_ELEMENT" and "highlight" not in props_to_apply:
            props_to_apply["highlight"] = True
            if "color" not in props_to_apply:
                props_to_apply["color"] = value or "#FEF08A"

        if operation == "REPLACE_TEXT" and "text" not in props_to_apply:
            props_to_apply["text"] = str(value)

        # 4. Apply all mutations atomically
        for prop, val in props_to_apply.items():
            if prop == "bold":
                elem.style.bold = (str(val).lower() in ("true", "1"))
            elif prop == "italic":
                elem.style.italic = (str(val).lower() in ("true", "1"))
            elif prop == "underline":
                elem.style.underline = (str(val).lower() in ("true", "1"))
            elif prop in ("strikethrough", "strike"):
                elem.style.strikethrough = (str(val).lower() in ("true", "1"))
            elif prop == "font_size":
                elem.style.font_size = int(round(float(val)))
            elif prop == "font_family":
                elem.style.font_family = str(val).strip()
            elif prop == "alignment":
                elem.style.alignment = str(val).lower()
            elif prop in ("indent", "left_indent"):
                elem.style.indent = float(val)
            elif prop == "line_spacing":
                elem.style.line_spacing = float(val)
            elif prop == "letter_spacing":
                elem.style.letter_spacing = float(val)
            elif prop == "color":
                val_str = str(val).strip().lower()
                elem.style.color = COLOR_NAME_MAP.get(val_str, str(val))
            elif prop == "highlight":
                elem.style.highlight = (str(val).lower() in ("true", "1") or bool(val))
            elif prop == "text":
                elem.text = str(val)

        after_state = elem.to_dict()

        summary_prop = property_name if property_name else ", ".join(props_to_apply.keys())
        summary_val = value if value is not None else props_to_apply

        return doc_copy, {
            "success": True,
            "target_id": target_element_id,
            "page_idx": page_idx,
            "operation": operation,
            "property": summary_prop,
            "value": summary_val,
            "updates": props_to_apply,
            "before": before_state,
            "after": after_state
        }
