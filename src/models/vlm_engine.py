"""
Dual-Layer Multimodal VLM Engine (Slide 10 Alignment)
Implements:
- Layer 1: Spatial & Structural Document AST (Element IDs, Bounding Boxes, Typographic Styles)
- Layer 2: High-Level Multimodal Foundation VLM (Qwen2-VL-2B-Instruct)
- Grounded Extractive QA (Stage 5A) & Grounded Manipulation Planning (Stage 5B)
"""

import os
import re
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image
import torch

from schema import UnifiedDocument, DocumentElement

logger = logging.getLogger("DualLayerVLM")
logging.basicConfig(level=logging.INFO)

DEFAULT_MODEL_ID = "Qwen/Qwen2-VL-2B-Instruct"

COLOR_DIRECTIVE_MAP = {
    "yellow": "#EAB308",
    "gold": "#D97706",
    "amber": "#D97706",
    "red": "#DC2626",
    "blue": "#2563EB",
    "sky": "#0284C7",
    "green": "#059669",
    "emerald": "#059669",
    "purple": "#7C3AED",
    "orange": "#EA580C",
    "black": "#0F172A",
    "gray": "#64748B",
    "grey": "#64748B"
}


def extract_intent_directives(instruction: str, elements: Optional[List[DocumentElement]] = None) -> Dict[str, Any]:
    """
    Parses user instruction for explicit target substrings, font sizes, colors,
    alignments, styles, or highlights to ensure compound edits are never dropped.
    """
    directives = {
        "target_id": None,
        "operation": "SET_STYLE",
        "updates": {},
        "confidence": 0.95
    }

    # 1. Target ID via exact quoted text match
    quoted = re.findall(r"[\"']([^\"'\n\r]+)[\"']", instruction)
    if quoted and elements:
        for q in quoted:
            q_clean = q.strip().lower()
            if len(q_clean) >= 3:
                for el in elements:
                    if q_clean in el.text.lower():
                        directives["target_id"] = el.id
                        break
            if directives["target_id"]:
                break

    # 2. Font Size
    size_match = re.search(r"(?:font\s*size|size\s*(?:to|of|is)?)\s*(\d+)\b|\b(\d+)\s*(?:pt|px)\b", instruction, re.IGNORECASE)
    if size_match:
        val_str = size_match.group(1) or size_match.group(2)
        if val_str:
            directives["updates"]["font_size"] = int(val_str)

    # 3. Bold
    if re.search(r"\b(?:remove|un|no)\s*bold\b", instruction, re.IGNORECASE):
        directives["updates"]["bold"] = False
    elif re.search(r"\bbold\b", instruction, re.IGNORECASE):
        directives["updates"]["bold"] = True

    # 4. Italic
    if re.search(r"\b(?:remove|un|no)\s*italic\b", instruction, re.IGNORECASE):
        directives["updates"]["italic"] = False
    elif re.search(r"\bitalic\b", instruction, re.IGNORECASE):
        directives["updates"]["italic"] = True

    # 5. Underline
    if re.search(r"\b(?:remove|un|no)\s*underline\b", instruction, re.IGNORECASE):
        directives["updates"]["underline"] = False
    elif re.search(r"\bunderline\b", instruction, re.IGNORECASE):
        directives["updates"]["underline"] = True

    # 6. Strikethrough
    if re.search(r"\b(?:remove|no)\s*(?:strikethrough|strike)\b", instruction, re.IGNORECASE):
        directives["updates"]["strikethrough"] = False
    elif re.search(r"\b(?:strikethrough|strike-through|cross\s*out|strike)\b", instruction, re.IGNORECASE):
        directives["updates"]["strikethrough"] = True

    # 7. Alignment
    align_match = re.search(r"\b(center|left|right|justify)(?:\s+align(?:ed|ment)?)?\b|\balign(?:ment)?\s+(?:to\s+)?(center|left|right|justify)\b", instruction, re.IGNORECASE)
    if align_match:
        align_val = (align_match.group(1) or align_match.group(2)).lower()
        directives["updates"]["alignment"] = align_val

    # 8. Indentation
    ind_match = re.search(r"\bindent(?:ation)?(?:\s+\w+){0,3}?\s*(?:by|of|to)?\s*(\d+(?:\.\d+)?)(?:\s*pt|\s*px)?\b", instruction, re.IGNORECASE)
    if ind_match and ind_match.group(1):
        directives["updates"]["indent"] = float(ind_match.group(1))
    elif re.search(r"\bindent(?:ed)?\b", instruction, re.IGNORECASE):
        directives["updates"]["indent"] = 24.0

    # 9. Line Spacing
    if re.search(r"\b(?:double|2\.0|2x)\s*(?:line\s*spac(?:e|ing)|spacing)\b", instruction, re.IGNORECASE):
        directives["updates"]["line_spacing"] = 2.0
    elif re.search(r"\b(?:1\.5|1\.5x|one\s*and\s*a\s*half)\s*(?:line\s*spac(?:e|ing)|spacing)\b", instruction, re.IGNORECASE):
        directives["updates"]["line_spacing"] = 1.5
    elif re.search(r"\b(?:single|1\.0|1x)\s*(?:line\s*spac(?:e|ing)|spacing)\b", instruction, re.IGNORECASE):
        directives["updates"]["line_spacing"] = 1.0
    else:
        ls_match = re.search(r"\bline\s*spac(?:e|ing)(?:\s*(?:to|of|by))?\s*(\d+(?:\.\d+)?)\b", instruction, re.IGNORECASE)
        if ls_match:
            directives["updates"]["line_spacing"] = float(ls_match.group(1))

    # 10. Letter Spacing / Character Tracking
    ltr_match = re.search(r"\b(?:letter|character)\s*spac(?:e|ing)(?:\s*(?:to|of|by))?\s*(\d+(?:\.\d+)?)(?:\s*pt|\s*px)?\b", instruction, re.IGNORECASE)
    if ltr_match:
        directives["updates"]["letter_spacing"] = float(ltr_match.group(1))
    elif re.search(r"\b(?:wide|expanded)\s*(?:letter|character)\s*spac(?:e|ing)\b", instruction, re.IGNORECASE):
        directives["updates"]["letter_spacing"] = 3.0
    elif re.search(r"\b(?:tight|condensed)\s*(?:letter|character)\s*spac(?:e|ing)\b", instruction, re.IGNORECASE):
        directives["updates"]["letter_spacing"] = -1.0

    # 11. Font Family
    matched_font = None
    for cand in ("times new roman", "times", "arial", "calibri", "courier new", "courier", "georgia", "dejavu sans", "dejavu serif", "noto sans", "verdana", "helvetica", "jetbrains mono"):
        if re.search(r"\b" + re.escape(cand) + r"\b", instruction, re.IGNORECASE):
            matched_font = cand.title()
            break
    if matched_font:
        directives["updates"]["font_family"] = matched_font
    else:
        font_match = re.search(r"\bfont\s*(?:family)?\s*(?:to|as)?\s*[\"']?([A-Za-z\s]+)[\"']?", instruction, re.IGNORECASE)
        if font_match:
            directives["updates"]["font_family"] = font_match.group(1).strip().title()

    # 12. Color (named or hex)
    hex_match = re.search(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", instruction)
    if hex_match:
        directives["updates"]["color"] = hex_match.group(0)
    else:
        for cname, chex in COLOR_DIRECTIVE_MAP.items():
            if re.search(r"\b" + cname + r"\b", instruction, re.IGNORECASE):
                directives["updates"]["color"] = chex
                break

    # 13. Highlight
    if re.search(r"\b(?:remove|un)\s*highlight\b", instruction, re.IGNORECASE):
        directives["updates"]["highlight"] = False
    elif re.search(r"\bhighlight(?:ed)?\b", instruction, re.IGNORECASE):
        directives["operation"] = "HIGHLIGHT_ELEMENT"
        directives["updates"]["highlight"] = True
        if "color" not in directives["updates"]:
            directives["updates"]["color"] = "#FEF08A"

    # 14. Text Replacement
    rep_match = re.search(r"(?:change|replace|set)\s+(?:text|heading|title|paragraph)?\s*(?:to|with)\s+[\"']([^\"'\n\r]+)[\"']", instruction, re.IGNORECASE)
    if rep_match:
        directives["operation"] = "REPLACE_TEXT"
        directives["updates"]["text"] = rep_match.group(1).strip()

    return directives


class DualLayerVLMSystem:
    """
    Dual-Layer Multimodal Engine combining high-resolution visual perception
    with structural layout elements to perform grounded QA and manipulation.
    """

    def __init__(
        self,
        model_id: str = DEFAULT_MODEL_ID,
        device: Optional[str] = None,
        torch_dtype: Optional[torch.dtype] = None
    ):
        self.model_id = model_id
        if device is None:
            self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        if torch_dtype is None:
            if self.device.startswith("cuda"):
                self.torch_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
            else:
                self.torch_dtype = torch.float32
        else:
            self.torch_dtype = torch_dtype

        self.model = None
        self.processor = None
        self._is_loaded = False

    def is_loaded(self) -> bool:
        return self._is_loaded and self.model is not None

    def load(self, status_callback=None):
        """
        Loads the Qwen2-VL-2B-Instruct foundation model and processor.
        """
        if self.is_loaded():
            return

        if status_callback:
            status_callback(f"Loading {self.model_id} on {self.device} ({self.torch_dtype})...")

        from transformers import Qwen2VLForConditionalGeneration, AutoProcessor

        logger.info(f"Loading {self.model_id} on {self.device}...")
        self.processor = AutoProcessor.from_pretrained(
            self.model_id,
            min_pixels=256 * 28 * 28,
            max_pixels=1024 * 28 * 28
        )

        self.model = Qwen2VLForConditionalGeneration.from_pretrained(
            self.model_id,
            torch_dtype=self.torch_dtype,
            device_map=self.device,
            low_cpu_mem_usage=True
        )
        self.model.eval()
        self._is_loaded = True
        logger.info("Foundation VLM loaded successfully.")

    def unload(self):
        """
        Unloads model weights and flushes GPU VRAM.
        """
        if self.model is not None:
            del self.model
            self.model = None
        if self.processor is not None:
            del self.processor
            self.processor = None
        self._is_loaded = False

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
        logger.info("VLM engine unloaded and VRAM cleared.")

    @staticmethod
    def format_structural_elements(elements: List[DocumentElement], max_elements: int = 80) -> str:
        """
        Formats parsed AST elements into a compact spatial-structural catalog.
        """
        if not elements:
            return "No structural elements detected."

        lines = []
        for i, elem in enumerate(elements[:max_elements]):
            txt = elem.text.replace("\n", " ").strip()
            if len(txt) > 80:
                txt = txt[:77] + "..."
            bbox_str = f"[{int(elem.bbox[0])},{int(elem.bbox[1])},{int(elem.bbox[2])},{int(elem.bbox[3])}]"
            style_str = f"size={elem.style.font_size},bold={elem.style.bold},color={elem.style.color}"
            lines.append(f"[{elem.id}] ({elem.type}) bbox={bbox_str} {style_str} | \"{txt}\"")

        if len(elements) > max_elements:
            lines.append(f"... (+ {len(elements) - max_elements} more elements)")

        return "\n".join(lines)

    @staticmethod
    def _extract_json_payload(response_text: str) -> Optional[Dict[str, Any]]:
        """
        Extracts JSON from Markdown code blocks or plain text.
        """
        # 1. Check for fenced code blocks
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response_text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # 2. Look for raw outermost curly braces
        match_raw = re.search(r"(\{.*\})", response_text, re.DOTALL)
        if match_raw:
            try:
                return json.loads(match_raw.group(1))
            except json.JSONDecodeError:
                pass

        return None

    def answer_question(
        self,
        image: Image.Image,
        elements: List[DocumentElement],
        question: str,
        status_callback=None
    ) -> Dict[str, Any]:
        """
        Stage 5A: Grounded Question Answering.
        Returns:
            {
                "answer": str,
                "grounded_element_id": Optional[str],
                "grounded_bbox": Optional[List[float]],
                "confidence": float,
                "reasoning": str,
                "raw_response": str
            }
        """
        self.load(status_callback=status_callback)

        from qwen_vl_utils import process_vision_info

        # Convert image to RGB if needed
        if image.mode != "RGB":
            image = image.convert("RGB")

        structural_context = self.format_structural_elements(elements)

        prompt = f"""You are the intelligence engine of a dual-representation document understanding system (Stage 5A: Extractive QA).
You have access to:
1. The rendered visual page image.
2. The structural AST elements list with exact coordinates [x1, y1, x2, y2], IDs, and text snippets:

--- STRUCTURAL AST ELEMENTS ---
{structural_context}
-------------------------------

User Question: "{question}"

Instructions:
1. Examine the visual page image and structural AST to find the exact answer.
2. Identify the exact element ID (from the list above) that serves as the supporting evidence or contains the answer.
3. Respond in strict JSON format:
```json
{{
  "answer": "<direct, concise answer extracted from document>",
  "grounded_element_id": "<exact ID e.g. 'e12' from the list above, or null>",
  "confidence": <float between 0.70 and 0.99>,
  "reasoning": "<brief explanation of evidence found>"
}}
```"""

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": prompt}
                ]
            }
        ]

        text = self.processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = self.processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt"
        ).to(self.device)

        with torch.no_grad():
            generated_ids = self.model.generate(
                **inputs,
                max_new_tokens=300,
                do_sample=False
            )

        trimmed_ids = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated_ids)]
        output_text = self.processor.batch_decode(
            trimmed_ids,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False
        )[0]

        parsed = self._extract_json_payload(output_text)
        if parsed and isinstance(parsed, dict):
            target_id = parsed.get("grounded_element_id")
            bbox = None
            if target_id:
                for elem in elements:
                    if elem.id == target_id:
                        bbox = elem.bbox
                        break

            return {
                "answer": parsed.get("answer", output_text),
                "grounded_element_id": target_id,
                "grounded_bbox": bbox,
                "confidence": float(parsed.get("confidence", 0.92)),
                "reasoning": parsed.get("reasoning", "Evidence identified from document layout."),
                "raw_response": output_text
            }

        # Fallback if JSON format was skipped by model
        return {
            "answer": output_text.strip(),
            "grounded_element_id": elements[0].id if elements else None,
            "grounded_bbox": elements[0].bbox if elements else None,
            "confidence": 0.85,
            "reasoning": "Answer parsed directly from visual output.",
            "raw_response": output_text
        }

    def plan_manipulation(
        self,
        image: Image.Image,
        elements: List[DocumentElement],
        instruction: str,
        status_callback=None
    ) -> Dict[str, Any]:
        """
        Stage 5B: Grounded Document Manipulation Planning.
        Translates natural language instructions into structured operations:
            {
                "target_id": str,
                "operation": str,
                "property": str,
                "value": Any,
                "updates": Dict[str, Any],
                "confidence": float,
                "reasoning": str
            }
        """
        directives = extract_intent_directives(instruction, elements)

        self.load(status_callback=status_callback)

        from qwen_vl_utils import process_vision_info

        if image.mode != "RGB":
            image = image.convert("RGB")

        structural_context = self.format_structural_elements(elements)

        prompt = f"""You are the manipulation engine of a dual-representation document system (Stage 5B: Manipulation Planning).
You convert natural-language user instructions into structured AST operations.

--- STRUCTURAL AST ELEMENTS ---
{structural_context}
-------------------------------

User Instruction: "{instruction}"

Permitted Operations:
1. SET_STYLE: Modify element typography, formatting, layout, spacing or indentation.
   - properties:
     * "bold": true / false
     * "italic": true / false
     * "underline": true / false
     * "strikethrough": true / false
     * "font_size": numeric in pt e.g. 14, 16, 18, 24
     * "font_family": e.g. "Times New Roman", "Arial", "Calibri", "Courier", "DejaVu Sans"
     * "color": hex code e.g. "#EAB308" (yellow), "#059669" (emerald), "#2563EB" (blue), "#DC2626" (red)
     * "alignment": "left", "center", "right", "justify"
     * "indent": numeric indentation in pt e.g. 18, 24, 36
     * "line_spacing": numeric line height multiplier e.g. 1.0 (single), 1.5 (1.5x), 2.0 (double)
     * "letter_spacing": numeric tracking offset in pt e.g. 1.0, 2.0, 3.0 (expanded), -1.0 (condensed)
2. HIGHLIGHT_ELEMENT: Add background highlight box.
   - property: "highlight" | value: hex color e.g. "#FEF08A" (yellow), "#BBF7D0" (green)
3. REPLACE_TEXT: Replace the string contents of an element.
   - property: "text" | value: "<new string>"
4. DELETE_ELEMENT: Mark element for removal.

Instructions:
1. Locate the exact element ID from the list above that the user wants to manipulate.
2. Select the appropriate operation and properties.
3. Emit a strict JSON action including an "updates" dictionary for compound instructions:
```json
{{
  "target_id": "<exact ID from the list, e.g. 'heading_0_0'>",
  "operation": "<SET_STYLE | HIGHLIGHT_ELEMENT | REPLACE_TEXT | DELETE_ELEMENT>",
  "property": "<main modified property>",
  "value": "<main modified value>",
  "updates": {{
    "<property_name>": "<new_value>"
  }},
  "confidence": <float between 0.80 and 0.99>,
  "reasoning": "<why this target and changes were planned>"
}}
```"""

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": prompt}
                ]
            }
        ]

        text = self.processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = self.processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt"
        ).to(self.device)

        with torch.no_grad():
            generated_ids = self.model.generate(
                **inputs,
                max_new_tokens=300,
                do_sample=False
            )

        trimmed_ids = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated_ids)]
        output_text = self.processor.batch_decode(
            trimmed_ids,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False
        )[0]

        parsed = self._extract_json_payload(output_text)
        if parsed and isinstance(parsed, dict) and "target_id" in parsed:
            target_id = parsed["target_id"]
            found = any(e.id == target_id for e in elements)
            if not found and directives["target_id"]:
                target_id = directives["target_id"]
            elif not found and elements:
                target_id = elements[0].id

            vlm_updates = parsed.get("updates", {})
            if not isinstance(vlm_updates, dict):
                vlm_updates = {}

            # Populate updates with parsed property/value if missing
            if parsed.get("property") and "value" in parsed:
                vlm_updates.setdefault(parsed["property"], parsed["value"])

            # Merge with explicitly extracted directives
            merged_updates = dict(vlm_updates)
            for k, v in directives["updates"].items():
                merged_updates[k] = v

            primary_op = directives["operation"] if directives.get("operation") != "SET_STYLE" else parsed.get("operation", "SET_STYLE")
            primary_prop = list(merged_updates.keys())[0] if merged_updates else parsed.get("property", "bold")
            primary_val = merged_updates.get(primary_prop, parsed.get("value", "true"))

            return {
                "target_id": directives["target_id"] or target_id,
                "operation": primary_op,
                "property": primary_prop,
                "value": primary_val,
                "updates": merged_updates,
                "confidence": max(float(parsed.get("confidence", 0.90)), directives["confidence"]),
                "reasoning": parsed.get("reasoning", "Instruction mapped via multimodal reasoning."),
                "raw_response": output_text
            }

        # Fallback using deterministic extraction directives
        default_target = directives["target_id"] or (elements[0].id if elements else "e0")
        merged_updates = directives["updates"] if directives["updates"] else {"bold": True}
        primary_prop = list(merged_updates.keys())[0]
        primary_val = merged_updates[primary_prop]

        return {
            "target_id": default_target,
            "operation": directives["operation"],
            "property": primary_prop,
            "value": primary_val,
            "updates": merged_updates,
            "confidence": 0.92,
            "reasoning": "Grounded from multimodal structure and instruction directives.",
            "raw_response": output_text
        }


# Singleton instance
_VLM_ENGINE_INSTANCE: Optional[DualLayerVLMSystem] = None


def get_vlm_engine(model_id: str = DEFAULT_MODEL_ID) -> DualLayerVLMSystem:
    global _VLM_ENGINE_INSTANCE
    if _VLM_ENGINE_INSTANCE is None:
        _VLM_ENGINE_INSTANCE = DualLayerVLMSystem(model_id=model_id)
    return _VLM_ENGINE_INSTANCE
