"""
Read Section Tool: Reads a heading and all its contiguous child body paragraphs.
Equivalent to a human reading a complete section thoroughly.
"""

from typing import Dict, Any, List, Optional
from schema import UnifiedDocument, DocumentElement
from agent.base import BaseDocumentTool, ToolResult


class ReadSectionTool(BaseDocumentTool):
    """Tool to read the complete body content of a designated document section."""

    @property
    def name(self) -> str:
        return "read_section"

    @property
    def description(self) -> str:
        return (
            "Reads a complete section from the document. Provide either the element_id of the section "
            "heading (e.g. 'heading_3_4') or the section title (e.g. 'Conclusion', 'Operational Impact'). "
            "Returns the heading together with all its body paragraphs, bullet points, and composite bounding box."
        )

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "element_id": {
                    "type": "string",
                    "description": "Specific element ID of the heading (e.g. 'heading_3_4')."
                },
                "section_title": {
                    "type": "string",
                    "description": "Or section title keyword (e.g. 'Conclusion', 'Methodology')."
                },
                "page": {
                    "type": "integer",
                    "description": "Optional page number (1-indexed) if known.",
                    "default": None
                }
            },
            "required": []
        }

    def execute(self, doc: UnifiedDocument, **kwargs) -> ToolResult:
        element_id = kwargs.get("element_id")
        section_title = kwargs.get("section_title")
        page_num = kwargs.get("page")

        if not element_id and not section_title:
            return ToolResult(
                success=False,
                output="Must provide either 'element_id' or 'section_title'.",
                message="Missing required section identifier."
            )

        target_heading: Optional[DocumentElement] = None
        target_page_idx: int = -1

        pages_to_check = (
            [(page_num - 1, doc.pages[page_num - 1])]
            if (page_num and 1 <= page_num <= len(doc.pages))
            else list(enumerate(doc.pages))
        )

        # 1. Match by element_id
        if element_id:
            for p_idx, page in pages_to_check:
                for el in page.elements:
                    if el.id == element_id:
                        target_heading = el
                        target_page_idx = p_idx
                        break
                if target_heading:
                    break

        # 2. Match by section_title
        if not target_heading and section_title:
            st_lower = section_title.lower()
            for p_idx, page in pages_to_check:
                for el in page.elements:
                    if el.type == "heading" and st_lower in el.text.lower():
                        target_heading = el
                        target_page_idx = p_idx
                        break
                if target_heading:
                    break

        if not target_heading:
            return ToolResult(
                success=False,
                output=f"Section not found matching element_id='{element_id}' or title='{section_title}'. Use 'get_document_outline' to see available sections.",
                message="Target section heading could not be resolved."
            )

        page = doc.pages[target_page_idx]
        sorted_elements = sorted(page.elements, key=lambda el: (el.bbox[1], el.bbox[0]))

        try:
            h_idx = sorted_elements.index(target_heading)
        except ValueError:
            h_idx = -1

        section_nodes = [target_heading]
        if h_idx >= 0:
            for el in sorted_elements[h_idx + 1:]:
                if el.type == "heading":
                    break
                if el.type in ("paragraph", "list_item", "text"):
                    # Check vertical proximity
                    if el.bbox[1] - section_nodes[-1].bbox[3] <= 35.0:
                        section_nodes.append(el)
                    else:
                        break
                elif len(section_nodes) > 1:
                    break
                if len(section_nodes) >= 8:
                    break

        min_x = min(el.bbox[0] for el in section_nodes)
        min_y = min(el.bbox[1] for el in section_nodes)
        max_x = max(el.bbox[2] for el in section_nodes)
        max_y = max(el.bbox[3] for el in section_nodes)
        composite_bbox = [round(min_x, 2), round(min_y, 2), round(max_x, 2), round(max_y, 2)]

        content_parts = [f"### Section: **{target_heading.text.strip()}** (Page {target_page_idx + 1}, Block #{target_heading.id})\n"]
        for el in section_nodes[1:]:
            content_parts.append(f"- Block `#{el.id}`: {el.text.strip()}\n")

        full_text = f"**{target_heading.text.strip()}**\n\n" + "\n\n".join(el.text.strip() for el in section_nodes[1:])

        return ToolResult(
            success=True,
            output="\n".join(content_parts),
            message=f"Successfully read Section '{target_heading.text.strip()}' with {len(section_nodes) - 1} body paragraphs.",
            metadata={
                "page": target_page_idx + 1,
                "page_idx": target_page_idx,
                "heading_id": target_heading.id,
                "heading_text": target_heading.text.strip(),
                "node_ids": [el.id for el in section_nodes],
                "full_text": full_text,
                "composite_bbox": composite_bbox,
                "primary_grounded_element_id": target_heading.id
            }
        )
