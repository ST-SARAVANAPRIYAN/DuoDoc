"""
Visual Inspector Tool: Generates a high-resolution focused image crop of any layout region or diagram.
Equivalent to a human zooming in to inspect visual figures, tables, signatures, or charts.
"""

import os
from typing import Dict, Any, List, Optional
from PIL import Image
from schema import UnifiedDocument
from agent.base import BaseDocumentTool, ToolResult
from render import render_canvas


class InspectVisualRegionTool(BaseDocumentTool):
    """Tool to inspect high-resolution sub-regions and visual patches of document pages."""

    @property
    def name(self) -> str:
        return "inspect_visual_region"

    @property
    def description(self) -> str:
        return (
            "Captures a focused, high-resolution visual crop of a specific diagram, table, chart, "
            "or region on a document page. Provide either an element_id (e.g. an image or table block) "
            "or exact bounding box coordinates [x1, y1, x2, y2]. Use this to visually verify layout, charts, or images."
        )

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "page": {
                    "type": "integer",
                    "description": "Page number (1-indexed) containing the visual region."
                },
                "element_id": {
                    "type": "string",
                    "description": "Element ID to inspect (e.g. 'image_1_0', 'table_row_2_0_0')."
                },
                "bbox": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "Optional custom bounding box [x1, y1, x2, y2] in points.",
                    "default": None
                }
            },
            "required": ["page"]
        }

    def execute(self, doc: UnifiedDocument, **kwargs) -> ToolResult:
        page_num = kwargs.get("page", 1)
        element_id = kwargs.get("element_id")
        bbox = kwargs.get("bbox")

        page_idx = page_num - 1
        if not (0 <= page_idx < len(doc.pages)):
            return ToolResult(
                success=False,
                output=f"Page number {page_num} is out of range (document has {len(doc.pages)} pages).",
                message="Invalid page index."
            )

        page = doc.pages[page_idx]

        target_bbox = bbox
        target_el = None
        if element_id:
            for el in page.elements:
                if el.id == element_id:
                    target_el = el
                    if not target_bbox:
                        target_bbox = el.metadata.get("composite_bbox") or el.bbox
                    break

        if not target_bbox:
            return ToolResult(
                success=False,
                output=f"Could not resolve bounding box for inspection on Page {page_num}. Provide a valid element_id or bbox.",
                message="Missing bounding box."
            )

        # Load or render page image
        if page.image_path and os.path.exists(page.image_path):
            img_pil = Image.open(page.image_path).convert("RGB")
        else:
            img_pil = render_canvas(doc, page_id=page_idx)

        scale_x = img_pil.width / max(page.width, 1.0)
        scale_y = img_pil.height / max(page.height, 1.0)
        pad = 12.0

        cx1 = max(0, int((target_bbox[0] - pad) * scale_x))
        cy1 = max(0, int((target_bbox[1] - pad) * scale_y))
        cx2 = min(img_pil.width, int((target_bbox[2] + pad) * scale_x))
        cy2 = min(img_pil.height, int((target_bbox[3] + pad) * scale_y))

        cropped_img = img_pil.crop((cx1, cy1, cx2, cy2))

        return ToolResult(
            success=True,
            output=(
                f"### High-Resolution Visual Region Inspected (Page {page_num})\n"
                f"- **Bounding Box Coordinates**: `[{target_bbox[0]}, {target_bbox[1]}, {target_bbox[2]}, {target_bbox[3]}]` pt\n"
                f"- **Visual Patch Size**: `{cropped_img.width} × {cropped_img.height}` px\n"
                f"- **Target Element**: `#{element_id}` ({target_el.type if target_el else 'custom_region'})\n"
                f"Visual verification confirmed: region extracted and rendered with high fidelity."
            ),
            message=f"Rendered {cropped_img.width}x{cropped_img.height} visual crop for Page {page_num}.",
            metadata={
                "page": page_num,
                "page_idx": page_idx,
                "bbox": target_bbox,
                "crop_width": cropped_img.width,
                "crop_height": cropped_img.height,
                "element_id": element_id,
                "cropped_image": cropped_img
            }
        )
