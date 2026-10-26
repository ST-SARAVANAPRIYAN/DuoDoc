"""
Document State Executor
Implements Slide 10: Stage 6 (Operation Execution).

Performs atomic, verified state transitions on the UnifiedDocument AST
and generates execution diff audits.
"""

import copy
import re
from typing import Dict, Any, Tuple, Optional, List
from schema import UnifiedDocument, DocumentElement, ElementStyle
from .validator import ActionSafetyValidator, COLOR_NAME_MAP


class DocumentStateExecutor:
    """
    Applies validated structural and stylistic modifications to a UnifiedDocument.
    """

    @staticmethod
    def _apply_props_to_element(elem: DocumentElement, props_to_apply: Dict[str, Any]):
        for prop, val in props_to_apply.items():
            if prop == "bold":
                elem.style.bold = (str(val).lower() in ("true", "1") or bool(val))
            elif prop == "italic":
                elem.style.italic = (str(val).lower() in ("true", "1") or bool(val))
            elif prop == "underline":
                elem.style.underline = (str(val).lower() in ("true", "1") or bool(val))
            elif prop in ("strikethrough", "strike"):
                elem.style.strikethrough = (str(val).lower() in ("true", "1") or bool(val))
            elif prop == "subscript":
                elem.style.subscript = (str(val).lower() in ("true", "1") or bool(val))
                if elem.style.subscript:
                    elem.style.superscript = False
            elif prop == "superscript":
                elem.style.superscript = (str(val).lower() in ("true", "1") or bool(val))
                if elem.style.superscript:
                    elem.style.subscript = False
            elif prop == "text_case":
                case_val = str(val).lower()
                elem.style.text_case = case_val
                if case_val == "uppercase":
                    elem.text = elem.text.upper()
                elif case_val == "lowercase":
                    elem.text = elem.text.lower()
                elif case_val in ("capitalize", "titlecase"):
                    elem.text = elem.text.title()
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

    @staticmethod
    def execute_action(
        doc: UnifiedDocument,
        target_element_id: str,
        operation: str,
        property_name: Optional[str] = None,
        value: Any = None,
        updates: Optional[Dict[str, Any]] = None,
        target_element_ids: Optional[List[str]] = None,
        target_text: Optional[str] = None
    ) -> Tuple[Optional[UnifiedDocument], Dict[str, Any]]:
        """
        Executes an action or compound updates on a deep copy of the document.
        Supports single target element or coordinated multi-element groups (e.g. multi-line titles).
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

        # 4. Apply mutations to primary target and any grouped target elements
        all_targets = [target_element_id]
        if target_element_ids:
            for tid in target_element_ids:
                if tid not in all_targets:
                    all_targets.append(tid)

        if operation == "CLEAR_STYLE":
            for tid in all_targets:
                t_found = doc_copy.find_element(tid)
                if t_found:
                    _, t_elem = t_found
                    t_elem.style = ElementStyle()
                    t_elem.metadata.pop("spans", None)
        elif target_text:
            # Substring / span-level mutation: do not override entire element's base style
            for tid in all_targets:
                t_found = doc_copy.find_element(tid)
                if t_found:
                    _, t_elem = t_found
                    if target_text.lower() in t_elem.text.lower():
                        # Handle text_case transform on the target substring
                        curr_target = target_text
                        if "text_case" in props_to_apply:
                            tc = str(props_to_apply["text_case"]).lower()
                            if tc == "uppercase":
                                repl = curr_target.upper()
                            elif tc == "lowercase":
                                repl = curr_target.lower()
                            elif tc in ("capitalize", "titlecase"):
                                repl = curr_target.title()
                            else:
                                repl = curr_target
                            pattern = re.compile(re.escape(curr_target), re.IGNORECASE)
                            t_elem.text = pattern.sub(repl, t_elem.text, count=1)
                            curr_target = repl

                        style_updates = {k: v for k, v in props_to_apply.items() if k != "text_case"}
                        if style_updates:
                            if "spans" not in t_elem.metadata:
                                t_elem.metadata["spans"] = []
                            # Check if a span for this exact substring already exists
                            existing_span = next(
                                (s for s in t_elem.metadata["spans"] if s.get("text", "").lower() == curr_target.lower()),
                                None
                            )
                            if existing_span:
                                existing_span.setdefault("style", {}).update(style_updates)
                            else:
                                t_elem.metadata["spans"].append({
                                    "text": curr_target,
                                    "style": dict(style_updates)
                                })
        else:
            for tid in all_targets:
                t_found = doc_copy.find_element(tid)
                if t_found:
                    _, t_elem = t_found
                    DocumentStateExecutor._apply_props_to_element(t_elem, props_to_apply)

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
